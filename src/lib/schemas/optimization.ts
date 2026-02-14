import { z } from "zod";

export const OptimizationJobCreateSchema = z.object({
  brandId: z.string().uuid(),
  sourceUrl: z.string().url("Must be a valid URL"),
});

export const KeywordDetectionSchema = z.object({
  primaryKeyword: z.string(),
  secondaryKeywords: z.array(z.string()),
  currentDensity: z.number().optional(),
  suggestedDensity: z.number().optional(),
});

export const CompetitorBriefSchema = z.object({
  competitors: z.array(z.object({
    url: z.string(),
    title: z.string(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
  })),
  contentGaps: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type OptimizationJobCreate = z.infer<typeof OptimizationJobCreateSchema>;
export type KeywordDetection = z.infer<typeof KeywordDetectionSchema>;
export type CompetitorBrief = z.infer<typeof CompetitorBriefSchema>;
