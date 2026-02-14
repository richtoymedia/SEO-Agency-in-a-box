import { z } from "zod";
import { router, tenantProcedure } from "../init";
import { ContentJobCreateSchema, ContentJobBatchCreateSchema } from "@/lib/schemas";
import { TRPCError } from "@trpc/server";
import { contentQueue, repurposeQueue } from "@/server/queue/queues";

export const jobRouter = router({
  list: tenantProcedure
    .input(z.object({
      brandId: z.string().uuid().optional(),
      status: z.enum(["IDLE", "QUEUED", "RUNNING", "COMPLETED", "FAILED"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.contentJob.findMany({
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
      const job = await ctx.prisma.contentJob.findFirst({
        where: { id: input.id, tenantId: ctx.tenantId },
        include: { brand: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      return job;
    }),

  create: tenantProcedure
    .input(ContentJobCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const brand = await ctx.prisma.brand.findFirst({
        where: { id: input.brandId, tenantId: ctx.tenantId },
      });
      if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });

      return ctx.prisma.contentJob.create({
        data: {
          tenantId: ctx.tenantId,
          brandId: input.brandId,
          topic: input.topic,
          keywords: input.keywords,
        },
      });
    }),

  createBatch: tenantProcedure
    .input(ContentJobBatchCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const brand = await ctx.prisma.brand.findFirst({
        where: { id: input.brandId, tenantId: ctx.tenantId },
      });
      if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });

      const jobs = await ctx.prisma.$transaction(
        input.jobs.map((j) =>
          ctx.prisma.contentJob.create({
            data: {
              tenantId: ctx.tenantId,
              brandId: input.brandId,
              topic: j.topic,
              keywords: j.keywords,
            },
          })
        )
      );
      return jobs;
    }),

  enqueueGenerate: tenantProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.contentJob.findFirst({
        where: { id: input.jobId, tenantId: ctx.tenantId },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.contentJob.update({
        where: { id: input.jobId },
        data: { status: "QUEUED" },
      });

      await contentQueue.add("content-generate", {
        jobId: input.jobId,
        tenantId: ctx.tenantId,
      });

      return { status: "QUEUED" };
    }),

  enqueueGenerateBatch: tenantProcedure
    .input(z.object({ jobIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      const jobs = await ctx.prisma.contentJob.findMany({
        where: { id: { in: input.jobIds }, tenantId: ctx.tenantId },
      });
      if (jobs.length !== input.jobIds.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Some jobs not found" });
      }

      await ctx.prisma.contentJob.updateMany({
        where: { id: { in: input.jobIds } },
        data: { status: "QUEUED" },
      });

      for (const jobId of input.jobIds) {
        await contentQueue.add("content-generate", {
          jobId,
          tenantId: ctx.tenantId,
        });
      }

      return { queued: input.jobIds.length };
    }),

  retry: tenantProcedure
    .input(z.object({
      jobId: z.string().uuid(),
      fromStep: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.contentJob.findFirst({
        where: { id: input.jobId, tenantId: ctx.tenantId },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.contentJob.update({
        where: { id: input.jobId },
        data: {
          status: "QUEUED",
          lastError: null,
          failedStep: null,
          retryCount: { increment: 1 },
        },
      });

      await contentQueue.add("content-generate", {
        jobId: input.jobId,
        tenantId: ctx.tenantId,
        fromStep: input.fromStep,
      });

      return { status: "QUEUED" };
    }),

  repurpose: tenantProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.contentJob.findFirst({
        where: { id: input.jobId, tenantId: ctx.tenantId },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      if (!job.articleMarkdown) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Article not generated yet" });
      }

      await ctx.prisma.contentJob.update({
        where: { id: input.jobId },
        data: { repurposeStatus: "running", repurposeStartedAt: new Date() },
      });

      await repurposeQueue.add("repurpose", {
        jobId: input.jobId,
        tenantId: ctx.tenantId,
      });

      return { status: "QUEUED" };
    }),
});
