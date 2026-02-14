import { z } from "zod";

export const SerpResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
});

export const ResearchBriefSchema = z.object({
  targetKeyword: z.string(),
  relatedKeywords: z.array(z.string()),
  searchIntent: z.string(),
  topCompetitors: z.array(z.object({
    url: z.string(),
    title: z.string(),
    keyTakeaways: z.array(z.string()),
  })),
  contentAngle: z.string(),
  suggestedOutline: z.array(z.object({
    heading: z.string(),
    subPoints: z.array(z.string()),
  })),
  peopleAlsoAsk: z.array(z.string()),
  estimatedWordCount: z.number(),
});

export const ImageSpecSchema = z.object({
  placement: z.string(),
  prompt: z.string(),
  altText: z.string(),
  aspectRatio: z.string().default("16:9"),
});

export const MetaSchema = z.object({
  title: z.string().max(70),
  description: z.string().max(160),
  slug: z.string(),
});

export const ThumbnailSpecSchema = z.object({
  prompt: z.string(),
  overlayText: z.string().optional(),
  style: z.string(),
});

export const RepurposeLinkedInSchema = z.object({
  hook: z.string(),
  body: z.string(),
  hashtags: z.array(z.string()),
});

export const RepurposeYouTubeSchema = z.object({
  segments: z.array(z.object({
    title: z.string(),
    script: z.string(),
    bRollSuggestion: z.string(),
    onScreenText: z.string().optional(),
  })),
});

export const RepurposeOutputSchema = z.object({
  linkedin: RepurposeLinkedInSchema,
  youtube: RepurposeYouTubeSchema,
});

export type ResearchBrief = z.infer<typeof ResearchBriefSchema>;
export type ImageSpec = z.infer<typeof ImageSpecSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type ThumbnailSpec = z.infer<typeof ThumbnailSpecSchema>;
export type RepurposeOutput = z.infer<typeof RepurposeOutputSchema>;
