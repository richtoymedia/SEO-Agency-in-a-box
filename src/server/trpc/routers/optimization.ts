import { z } from "zod";
import { router, tenantProcedure } from "../init";
import { OptimizationJobCreateSchema } from "@/lib/schemas";
import { TRPCError } from "@trpc/server";
import { optimizationQueue } from "@/server/queue/queues";

export const optimizationRouter = router({
  list: tenantProcedure
    .input(z.object({
      brandId: z.string().uuid().optional(),
      status: z.enum(["IDLE", "QUEUED", "RUNNING", "COMPLETED", "FAILED"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.optimizationJob.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input?.brandId ? { brandId: input.brandId } : {}),
          ...(input?.status ? { status: input.status } : {}),
        },
        include: { brand: { select: { companyName: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  get: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.prisma.optimizationJob.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        include: { brand: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      return job;
    }),

  create: tenantProcedure
    .input(OptimizationJobCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const brand = await ctx.prisma.brand.findFirst({
        where: { id: input.brandId, tenantId: ctx.tenantId },
      });
      if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });

      return ctx.prisma.optimizationJob.create({
        data: {
          tenantId: ctx.tenantId,
          brandId: input.brandId,
          sourceUrl: input.sourceUrl,
        },
      });
    }),

  run: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.optimizationJob.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.optimizationJob.update({
        where: { id: input.id },
        data: { status: "QUEUED" },
      });

      await optimizationQueue.add("optimization-run", {
        jobId: input.id,
        tenantId: ctx.tenantId,
      });

      return { status: "QUEUED" };
    }),

  retry: tenantProcedure
    .input(z.object({
      id: z.string().uuid(),
      fromStep: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.optimizationJob.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.optimizationJob.update({
        where: { id: input.id },
        data: {
          status: "QUEUED",
          lastError: null,
          failedStep: null,
          retryCount: { increment: 1 },
        },
      });

      await optimizationQueue.add("optimization-run", {
        jobId: input.id,
        tenantId: ctx.tenantId,
        fromStep: input.fromStep,
      });

      return { status: "QUEUED" };
    }),
});
