import { PrismaClient } from "@prisma/client";
import { claudeChat, claudeJSON } from "./claude";
import { geminiStructured, geminiToolLoop } from "./gemini";
import { serpSearch } from "./serp";
import { scrape } from "./firecrawl";
import { generateImage } from "./fal";
import {
  ResearchBriefSchema,
  ImageSpecSchema,
  MetaSchema,
  ThumbnailSpecSchema,
  RepurposeOutputSchema,
  type ResearchBrief,
  type ImageSpec,
  type Meta,
  type ThumbnailSpec,
} from "@/lib/schemas/pipeline-outputs";
import { z } from "zod";

const prisma = new PrismaClient();

type StepName = "research" | "imageSpecs" | "images" | "article" | "meta" | "thumbnail" | "repurpose";

async function updateStepStatus(
  jobId: string,
  step: StepName,
  status: "running" | "succeeded" | "failed",
  extra: Record<string, unknown> = {}
) {
  const data: Record<string, unknown> = {
    [`${step}Status`]: status,
    ...extra,
  };
  if (status === "running") {
    data[`${step}StartedAt`] = new Date();
    data.status = "RUNNING";
  } else if (status === "succeeded") {
    data[`${step}CompletedAt`] = new Date();
  } else if (status === "failed") {
    data[`${step}CompletedAt`] = new Date();
  }

  await prisma.contentJob.update({ where: { id: jobId }, data });
}

function isMockMode(): boolean {
  return !process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY;
}

function getMockResearchBrief(topic: string, keywords: string[]): ResearchBrief {
  return {
    targetKeyword: keywords[0] || topic,
    relatedKeywords: keywords.slice(1).concat(["best practices", "guide", "tips"]),
    searchIntent: "informational",
    topCompetitors: [
      { url: "https://example.com/competitor-1", title: "Competitor Article 1", keyTakeaways: ["Comprehensive coverage", "Good structure"] },
      { url: "https://example.com/competitor-2", title: "Competitor Article 2", keyTakeaways: ["Expert insights", "Data-driven"] },
    ],
    contentAngle: `A comprehensive guide to ${topic} with actionable insights and expert recommendations.`,
    suggestedOutline: [
      { heading: `What is ${topic}?`, subPoints: ["Definition", "Why it matters"] },
      { heading: `Key Strategies for ${keywords[0] || topic}`, subPoints: ["Strategy 1", "Strategy 2", "Strategy 3"] },
      { heading: "Best Practices", subPoints: ["Tip 1", "Tip 2", "Common mistakes to avoid"] },
      { heading: "Tools and Resources", subPoints: ["Recommended tools", "Further reading"] },
      { heading: "Conclusion", subPoints: ["Key takeaways", "Next steps"] },
    ],
    peopleAlsoAsk: [`What is ${topic}?`, `How to improve ${topic}?`, `Why is ${topic} important?`],
    estimatedWordCount: 2000,
  };
}

function getMockImageSpecs(topic: string): ImageSpec[] {
  return [
    { placement: "hero", prompt: `Professional illustration of ${topic} concept`, altText: `${topic} overview`, aspectRatio: "16:9" },
    { placement: "section-1", prompt: `Diagram showing ${topic} strategy framework`, altText: `${topic} framework`, aspectRatio: "16:9" },
    { placement: "section-2", prompt: `Team collaborating on ${topic} project`, altText: `${topic} teamwork`, aspectRatio: "16:9" },
  ];
}

function getMockMeta(topic: string): Meta {
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    title: `${topic} - Complete Guide (2024)`.slice(0, 70),
    description: `Learn everything about ${topic}. Expert tips, strategies, and best practices to help you succeed.`.slice(0, 160),
    slug,
  };
}

export async function runContentPipeline(
  jobId: string,
  fromStep?: string
): Promise<void> {
  const job = await prisma.contentJob.findUnique({
    where: { id: jobId },
    include: { brand: true },
  });
  if (!job) throw new Error(`Job ${jobId} not found`);

  const brand = job.brand;
  const steps: StepName[] = ["research", "imageSpecs", "images", "article", "meta", "thumbnail", "repurpose"];
  const startIdx = fromStep ? steps.indexOf(fromStep as StepName) : 0;

  await prisma.contentJob.update({ where: { id: jobId }, data: { status: "RUNNING" } });

  try {
    // Step 1: Research
    if (startIdx <= 0) {
      if (job.researchStatus === "succeeded" && job.researchBriefJson) {
        // Skip - already done
      } else {
        await updateStepStatus(jobId, "research", "running");
        try {
          let brief: ResearchBrief;
          if (isMockMode()) {
            brief = getMockResearchBrief(job.topic, job.keywords);
          } else {
            brief = await geminiToolLoop({
              prompt: `Research the topic "${job.topic}" with keywords: ${job.keywords.join(", ")}.\n\nUse the serpSearch tool to search for relevant content and the scrape tool to get content from top results.\n\nProduce a comprehensive research brief with: targetKeyword, relatedKeywords, searchIntent, topCompetitors (url, title, keyTakeaways), contentAngle, suggestedOutline (heading, subPoints), peopleAlsoAsk, and estimatedWordCount.`,
              tools: [
                { name: "serpSearch", description: "Search Google for a query", fn: async (args) => JSON.stringify(await serpSearch(args.query || job.keywords[0])) },
                { name: "scrape", description: "Scrape a URL for content", fn: async (args) => { const r = await scrape(args.url || ""); return r.markdown.slice(0, 3000); } },
              ],
              maxTurns: 5,
              finalSchema: ResearchBriefSchema,
            });
          }
          await updateStepStatus(jobId, "research", "succeeded", { researchBriefJson: brief });
        } catch (err) {
          await updateStepStatus(jobId, "research", "failed", {
            researchError: err instanceof Error ? err.message : String(err),
            failedStep: "research",
            lastError: err instanceof Error ? err.message : String(err),
            status: "FAILED",
          });
          return;
        }
      }
    }

    // Reload job to get updated data
    const jobAfterResearch = await prisma.contentJob.findUnique({ where: { id: jobId } });
    if (!jobAfterResearch) return;

    // Step 2: Image Specs
    if (startIdx <= 1) {
      if (jobAfterResearch.imageSpecsStatus === "succeeded" && jobAfterResearch.imageSpecsJson) {
        // Skip
      } else {
        await updateStepStatus(jobId, "imageSpecs", "running");
        try {
          let specs: ImageSpec[];
          if (isMockMode()) {
            specs = getMockImageSpecs(job.topic);
          } else {
            const specsResult = await geminiStructured({
              prompt: `Based on this research brief:\n${JSON.stringify(jobAfterResearch.researchBriefJson)}\n\nGenerate 3-4 image specifications for the article. Each spec should have: placement (where in article), prompt (AI image generation prompt), altText, and aspectRatio (16:9 or 1:1).`,
              schema: z.array(ImageSpecSchema),
            });
            specs = specsResult;
          }
          await updateStepStatus(jobId, "imageSpecs", "succeeded", { imageSpecsJson: specs });
        } catch (err) {
          await updateStepStatus(jobId, "imageSpecs", "failed", {
            imageSpecsError: err instanceof Error ? err.message : String(err),
            failedStep: "imageSpecs",
            lastError: err instanceof Error ? err.message : String(err),
            status: "FAILED",
          });
          return;
        }
      }
    }

    const jobAfterSpecs = await prisma.contentJob.findUnique({ where: { id: jobId } });
    if (!jobAfterSpecs) return;

    // Step 3: Generate Images
    if (startIdx <= 2) {
      if (jobAfterSpecs.imagesStatus === "succeeded" && jobAfterSpecs.imageUrlsJson) {
        // Skip
      } else {
        await updateStepStatus(jobId, "images", "running");
        try {
          const specs = (jobAfterSpecs.imageSpecsJson as unknown as ImageSpec[]) || [];
          const urls: string[] = [];
          for (const spec of specs) {
            const result = await generateImage({ prompt: spec.prompt, aspectRatio: spec.aspectRatio });
            urls.push(result.imageUrl);
          }
          await updateStepStatus(jobId, "images", "succeeded", { imageUrlsJson: urls });
        } catch (err) {
          await updateStepStatus(jobId, "images", "failed", {
            imagesError: err instanceof Error ? err.message : String(err),
            failedStep: "images",
            lastError: err instanceof Error ? err.message : String(err),
            status: "FAILED",
          });
          return;
        }
      }
    }

    const jobAfterImages = await prisma.contentJob.findUnique({ where: { id: jobId } });
    if (!jobAfterImages) return;

    // Step 4: Article Writing
    if (startIdx <= 3) {
      if (jobAfterImages.articleStatus === "succeeded" && jobAfterImages.articleMarkdown) {
        // Skip
      } else {
        await updateStepStatus(jobId, "article", "running");
        try {
          const brief = jobAfterImages.researchBriefJson as unknown as ResearchBrief;
          const specs = (jobAfterImages.imageSpecsJson as unknown as ImageSpec[]) || [];
          const imageUrls = (jobAfterImages.imageUrlsJson as unknown as string[]) || [];

          // Get sitemap pages for internal linking
          const sitemapPages = await prisma.sitemapPage.findMany({
            where: { tenantId: job.tenantId, brandId: job.brandId },
            take: 50,
          });

          const voiceStyle = brand.voiceStyleJson as Record<string, unknown>;
          const seoSettings = brand.seoSettingsJson as Record<string, unknown>;

          let article: string;
          if (isMockMode()) {
            const imagesMarkdown = specs.map((s, i) =>
              `![${s.altText}](${imageUrls[i] || "https://placehold.co/800x450"})`
            ).join("\n\n");
            const internalLinks = sitemapPages.slice(0, 3).map(p => `[${p.title || p.url}](${p.url})`).join(", ");

            article = `# ${job.topic}\n\n${imagesMarkdown}\n\n## Introduction\n\nWelcome to this comprehensive guide about ${job.topic}. ${brand.companyName} brings you the latest insights and strategies.\n\n${brief?.suggestedOutline?.map(s => `## ${s.heading}\n\n${s.subPoints.map(p => `- ${p}`).join("\n")}\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.\n`).join("\n") || ""}\n\n## Internal Resources\n\nCheck out these related articles: ${internalLinks || "More content coming soon."}\n\n## Conclusion\n\nWe hope this guide helps you master ${job.topic}. Stay tuned to ${brand.companyName} for more insights.\n`;
          } else {
            const imageInsertions = specs.map((s, i) =>
              `Image ${i + 1} (${s.placement}): ![${s.altText}](${imageUrls[i] || ""})`
            ).join("\n");

            article = await claudeChat({
              system: `You are a professional SEO content writer for ${brand.companyName} (${brand.siteUrl}). ${voiceStyle.tone ? `Tone: ${voiceStyle.tone}.` : ""} ${voiceStyle.style ? `Style: ${voiceStyle.style}.` : ""}`,
              prompt: `Write a comprehensive SEO article about "${job.topic}" with keywords: ${job.keywords.join(", ")}.

Research Brief: ${JSON.stringify(brief)}

Follow this outline structure. Target ${brief?.estimatedWordCount || 2000} words.

Embed these images at their specified placements:
${imageInsertions}

${sitemapPages.length > 0 ? `Include relevant internal links from: ${sitemapPages.map(p => `${p.title || ""}: ${p.url}`).join(", ")}` : ""}

Naturally mention ${brand.companyName} where appropriate.
Use proper heading hierarchy (H2, H3).
Write helpful, informative content following Google's helpful content guidelines.
Output as markdown.`,
              maxTokens: 8192,
            });
          }

          await updateStepStatus(jobId, "article", "succeeded", { articleMarkdown: article });
        } catch (err) {
          await updateStepStatus(jobId, "article", "failed", {
            articleError: err instanceof Error ? err.message : String(err),
            failedStep: "article",
            lastError: err instanceof Error ? err.message : String(err),
            status: "FAILED",
          });
          return;
        }
      }
    }

    // Step 5: Meta
    if (startIdx <= 4) {
      const jobNow = await prisma.contentJob.findUnique({ where: { id: jobId } });
      if (!jobNow) return;
      if (jobNow.metaStatus === "succeeded" && jobNow.metaJson) {
        // Skip
      } else {
        await updateStepStatus(jobId, "meta", "running");
        try {
          let meta: Meta;
          if (isMockMode()) {
            meta = getMockMeta(job.topic);
          } else {
            meta = await geminiStructured({
              prompt: `Generate SEO meta tags for this article:\nTopic: ${job.topic}\nKeywords: ${job.keywords.join(", ")}\n\nReturn JSON with: title (max 70 chars), description (max 160 chars), slug (URL-friendly).`,
              schema: MetaSchema,
            });
          }
          await updateStepStatus(jobId, "meta", "succeeded", { metaJson: meta });
        } catch (err) {
          await updateStepStatus(jobId, "meta", "failed", {
            metaError: err instanceof Error ? err.message : String(err),
            failedStep: "meta",
            lastError: err instanceof Error ? err.message : String(err),
            status: "FAILED",
          });
          return;
        }
      }
    }

    // Step 6: Thumbnail
    if (startIdx <= 5) {
      const jobNow = await prisma.contentJob.findUnique({ where: { id: jobId } });
      if (!jobNow) return;
      if (jobNow.thumbnailStatus === "succeeded" && jobNow.thumbnailUrl) {
        // Skip
      } else {
        await updateStepStatus(jobId, "thumbnail", "running");
        try {
          let thumbnailSpec: ThumbnailSpec;
          if (isMockMode()) {
            thumbnailSpec = {
              prompt: `Eye-catching thumbnail for "${job.topic}" blog post`,
              overlayText: job.topic.slice(0, 40),
              style: "modern, clean, professional",
            };
          } else {
            thumbnailSpec = await claudeJSON({
              system: "Generate a thumbnail specification for a blog post.",
              prompt: `Create a thumbnail spec for the article "${job.topic}". Return JSON with: prompt (image generation prompt), overlayText (optional short text), style.`,
              schema: ThumbnailSpecSchema,
            });
          }

          const thumbResult = await generateImage({ prompt: thumbnailSpec.prompt, aspectRatio: "16:9" });

          await updateStepStatus(jobId, "thumbnail", "succeeded", {
            thumbnailSpecJson: thumbnailSpec,
            thumbnailUrl: thumbResult.imageUrl,
          });
        } catch (err) {
          await updateStepStatus(jobId, "thumbnail", "failed", {
            thumbnailError: err instanceof Error ? err.message : String(err),
            failedStep: "thumbnail",
            lastError: err instanceof Error ? err.message : String(err),
            status: "FAILED",
          });
          return;
        }
      }
    }

    // Step 7: Repurpose
    if (startIdx <= 6) {
      const jobNow = await prisma.contentJob.findUnique({ where: { id: jobId } });
      if (!jobNow) return;
      if (jobNow.repurposeStatus === "succeeded" && jobNow.repurposeJson) {
        // Skip
      } else {
        await updateStepStatus(jobId, "repurpose", "running");
        try {
          await runRepurpose(jobId);
        } catch (err) {
          await updateStepStatus(jobId, "repurpose", "failed", {
            repurposeError: err instanceof Error ? err.message : String(err),
            failedStep: "repurpose",
            lastError: err instanceof Error ? err.message : String(err),
            status: "FAILED",
          });
          return;
        }
      }
    }

    // All steps complete
    await prisma.contentJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED" },
    });
  } catch (err) {
    await prisma.contentJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        lastError: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

export async function runRepurpose(jobId: string): Promise<void> {
  const job = await prisma.contentJob.findUnique({
    where: { id: jobId },
    include: { brand: true },
  });
  if (!job || !job.articleMarkdown) throw new Error("Job or article not found");

  if (isMockMode()) {
    const repurpose = {
      linkedin: {
        hook: `Just published a deep dive into ${job.topic}. Here's what you need to know:`,
        body: `We analyzed the latest trends in ${job.topic} and found some surprising insights.\n\nKey takeaways:\n1. Strategy matters more than tactics\n2. Consistency is the secret weapon\n3. Data-driven decisions win every time\n\nRead the full article to learn more about how ${job.brand.companyName} approaches ${job.topic}.`,
        hashtags: job.keywords.map(k => `#${k.replace(/\s+/g, "")}`).concat(["#SEO", "#ContentMarketing"]),
      },
      youtube: {
        segments: [
          { title: "Introduction", script: `Hey everyone! Today we're diving into ${job.topic}. This is going to be packed with actionable insights.`, bRollSuggestion: "Office environment, team working", onScreenText: job.topic },
          { title: "Key Strategies", script: `Let's talk about the main strategies for ${job.topic}. The first thing you need to understand is...`, bRollSuggestion: "Screen recording of examples", onScreenText: "Strategy #1" },
          { title: "Best Practices", script: `Now for the best practices. These are the things that separate the pros from the beginners.`, bRollSuggestion: "Whiteboard animation", onScreenText: "Best Practices" },
          { title: "Conclusion", script: `That's it for today! Don't forget to like, subscribe, and check out the full article at ${job.brand.siteUrl}.`, bRollSuggestion: "End screen with subscribe button", onScreenText: "Subscribe!" },
        ],
      },
    };
    await updateStepStatus(jobId, "repurpose", "succeeded", { repurposeJson: repurpose });
    return;
  }

  const raw = await claudeChat({
    system: "You are a content repurposing specialist. Convert blog articles into social media and video content.",
    prompt: `Repurpose this article into LinkedIn and YouTube formats.

Article: ${job.articleMarkdown.slice(0, 4000)}

Return JSON with:
1. "linkedin": { "hook": string, "body": string, "hashtags": string[] }
2. "youtube": { "segments": [{ "title": string, "script": string, "bRollSuggestion": string, "onScreenText": string (optional) }] }

Return ONLY valid JSON.`,
    temperature: 0.5,
  });

  let parsed: unknown;
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to parse repurpose output as JSON");
  }

  const validated = RepurposeOutputSchema.parse(parsed);
  await updateStepStatus(jobId, "repurpose", "succeeded", { repurposeJson: validated });
}
