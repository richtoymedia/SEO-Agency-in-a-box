import { z } from "zod";

export const BrandCreateSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  siteUrl: z.string().url("Must be a valid URL"),
  sitemapUrl: z.string().url().optional().or(z.literal("")),
  voiceStyleJson: z.record(z.string(), z.unknown()).optional().default({}),
  seoSettingsJson: z.record(z.string(), z.unknown()).optional().default({}),
  imageDefaultsJson: z.record(z.string(), z.unknown()).optional().default({}),
  internalLinkingJson: z.record(z.string(), z.unknown()).optional().default({}),
});

export const BrandUpdateSchema = BrandCreateSchema.partial();

export type BrandCreate = z.infer<typeof BrandCreateSchema>;
export type BrandUpdate = z.infer<typeof BrandUpdateSchema>;
