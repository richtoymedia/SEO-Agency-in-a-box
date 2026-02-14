import { z } from "zod";

export const ContentJobCreateSchema = z.object({
  brandId: z.string().uuid(),
  topic: z.string().min(1, "Topic is required"),
  keywords: z.array(z.string()).min(1, "At least one keyword is required"),
});

export const ContentJobBatchCreateSchema = z.object({
  brandId: z.string().uuid(),
  jobs: z.array(
    z.object({
      topic: z.string().min(1),
      keywords: z.array(z.string()).min(1),
    })
  ).min(1, "At least one job is required"),
});

export type ContentJobCreate = z.infer<typeof ContentJobCreateSchema>;
export type ContentJobBatchCreate = z.infer<typeof ContentJobBatchCreateSchema>;
