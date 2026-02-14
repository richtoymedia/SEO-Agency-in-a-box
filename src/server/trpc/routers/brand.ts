import { z } from "zod";
import { router, tenantProcedure } from "../init";
import { BrandCreateSchema, BrandUpdateSchema } from "@/lib/schemas";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";

export const brandRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.prisma.brand.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
    });
  }),

  get: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const brand = await ctx.prisma.brand.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
      });
      if (!brand) throw new TRPCError({ code: "NOT_FOUND" });
      return brand;
    }),

  create: tenantProcedure
    .input(BrandCreateSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.brand.create({
        data: {
          companyName: input.companyName,
          siteUrl: input.siteUrl,
          sitemapUrl: input.sitemapUrl || null,
          voiceStyleJson: (input.voiceStyleJson ?? {}) as Prisma.InputJsonValue,
          seoSettingsJson: (input.seoSettingsJson ?? {}) as Prisma.InputJsonValue,
          imageDefaultsJson: (input.imageDefaultsJson ?? {}) as Prisma.InputJsonValue,
          internalLinkingJson: (input.internalLinkingJson ?? {}) as Prisma.InputJsonValue,
          tenantId: ctx.tenantId,
        },
      });
    }),

  update: tenantProcedure
    .input(z.object({ id: z.string().uuid(), data: BrandUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.brand.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const data: Record<string, unknown> = {};
      if (input.data.companyName !== undefined) data.companyName = input.data.companyName;
      if (input.data.siteUrl !== undefined) data.siteUrl = input.data.siteUrl;
      if (input.data.sitemapUrl !== undefined) data.sitemapUrl = input.data.sitemapUrl === "" ? null : input.data.sitemapUrl;
      if (input.data.voiceStyleJson !== undefined) data.voiceStyleJson = input.data.voiceStyleJson;
      if (input.data.seoSettingsJson !== undefined) data.seoSettingsJson = input.data.seoSettingsJson;
      if (input.data.imageDefaultsJson !== undefined) data.imageDefaultsJson = input.data.imageDefaultsJson;
      if (input.data.internalLinkingJson !== undefined) data.internalLinkingJson = input.data.internalLinkingJson;

      return ctx.prisma.brand.update({
        where: { id: input.id },
        data,
      });
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.brand.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.brand.delete({ where: { id: input.id } });
      return { success: true };
    }),

  syncSitemap: tenantProcedure
    .input(z.object({ brandId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const brand = await ctx.prisma.brand.findFirst({
        where: { id: input.brandId, tenantId: ctx.tenantId },
      });
      if (!brand) throw new TRPCError({ code: "NOT_FOUND" });
      if (!brand.sitemapUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Brand has no sitemap URL" });
      }

      try {
        const res = await fetch(brand.sitemapUrl);
        const xml = await res.text();
        
        // Simple XML URL extraction
        const urlMatches = xml.match(/<loc>(.*?)<\/loc>/g) || [];
        const urls = urlMatches.map(m => m.replace(/<\/?loc>/g, ""));

        let count = 0;
        for (const url of urls) {
          await ctx.prisma.sitemapPage.upsert({
            where: {
              tenantId_brandId_url: {
                tenantId: ctx.tenantId,
                brandId: input.brandId,
                url,
              },
            },
            create: {
              tenantId: ctx.tenantId,
              brandId: input.brandId,
              url,
              lastSeenAt: new Date(),
            },
            update: {
              lastSeenAt: new Date(),
            },
          });
          count++;
        }

        return { synced: count };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to sync sitemap: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      }
    }),
});
