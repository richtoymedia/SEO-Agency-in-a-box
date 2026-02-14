import { PrismaClient } from "@prisma/client";
import { claudeChat } from "./claude";
import { geminiStructured, geminiToolLoop } from "./gemini";
import { serpSearch } from "./serp";
import { scrape } from "./firecrawl";
import {
  KeywordDetectionSchema,
  CompetitorBriefSchema,
  type KeywordDetection,
  type CompetitorBrief,
} from "@/lib/schemas/optimization";

const prisma = new PrismaClient();

type OptStepName = "scrape" | "detectKeyword" | "competitorResearch" | "audit" | "rewrite";

async function updateStepStatus(
  jobId: string,
  step: OptStepName,
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
  } else if (status === "succeeded" || status === "failed") {
    data[`${step}CompletedAt`] = new Date();
  }
  await prisma.optimizationJob.update({ where: { id: jobId }, data });
}

function isMockMode(): boolean {
  return !process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY;
}

export async function runOptimizationPipeline(
  jobId: string,
  fromStep?: string
): Promise<void> {
  const job = await prisma.optimizationJob.findUnique({
    where: { id: jobId },
    include: { brand: true },
  });
  if (!job) throw new Error(`Optimization job ${jobId} not found`);

  const steps: OptStepName[] = ["scrape", "detectKeyword", "competitorResearch", "audit", "rewrite"];
  const startIdx = fromStep ? steps.indexOf(fromStep as OptStepName) : 0;

  await prisma.optimizationJob.update({ where: { id: jobId }, data: { status: "RUNNING" } });

  try {
    // Step 1: Scrape
    if (startIdx <= 0) {
      if (job.scrapeStatus === "succeeded" && job.scrapedMarkdown) {
        // Skip
      } else {
        await updateStepStatus(jobId, "scrape", "running");
        try {
          const result = await scrape(job.sourceUrl);
          await updateStepStatus(jobId, "scrape", "succeeded", { scrapedMarkdown: result.markdown });
        } catch (err) {
          await updateStepStatus(jobId, "scrape", "failed", {
            scrapeError: err instanceof Error ? err.message : String(err),
            failedStep: "scrape",
            lastError: err instanceof Error ? err.message : String(err),
            status: "FAILED",
          });
          return;
        }
      }
    }

    const jobAfterScrape = await prisma.optimizationJob.findUnique({ where: { id: jobId } });
    if (!jobAfterScrape) return;

    // Step 2: Detect Keyword
    if (startIdx <= 1) {
      if (jobAfterScrape.detectKeywordStatus === "succeeded" && jobAfterScrape.detectedKeyword) {
        // Skip
      } else {
        await updateStepStatus(jobId, "detectKeyword", "running");
        try {
          let detection: KeywordDetection;
          if (isMockMode()) {
            detection = {
              primaryKeyword: "mock keyword from content",
              secondaryKeywords: ["related term 1", "related term 2", "related term 3"],
              currentDensity: 1.2,
              suggestedDensity: 1.5,
            };
          } else {
            detection = await geminiStructured({
              prompt: `Analyze this content and detect the primary target keyword and secondary keywords:\n\n${(jobAfterScrape.scrapedMarkdown || "").slice(0, 5000)}\n\nReturn: primaryKeyword, secondaryKeywords[], currentDensity (approximate %), suggestedDensity.`,
              schema: KeywordDetectionSchema,
            });
          }
          await updateStepStatus(jobId, "detectKeyword", "succeeded", {
            detectedKeyword: detection.primaryKeyword,
          });
        } catch (err) {
          await updateStepStatus(jobId, "detectKeyword", "failed", {
            detectKeywordError: err instanceof Error ? err.message : String(err),
            failedStep: "detectKeyword",
            lastError: err instanceof Error ? err.message : String(err),
            status: "FAILED",
          });
          return;
        }
      }
    }

    const jobAfterKeyword = await prisma.optimizationJob.findUnique({ where: { id: jobId } });
    if (!jobAfterKeyword) return;

    // Step 3: Competitor Research
    if (startIdx <= 2) {
      if (jobAfterKeyword.competitorResearchStatus === "succeeded" && jobAfterKeyword.competitorBriefJson) {
        // Skip
      } else {
        await updateStepStatus(jobId, "competitorResearch", "running");
        try {
          let brief: CompetitorBrief;
          if (isMockMode()) {
            brief = {
              competitors: [
                { url: "https://example.com/comp-1", title: "Competitor 1", strengths: ["Good structure", "Fresh data"], weaknesses: ["Thin content", "No images"] },
                { url: "https://example.com/comp-2", title: "Competitor 2", strengths: ["In-depth coverage", "Expert quotes"], weaknesses: ["Poor readability", "Slow loading"] },
              ],
              contentGaps: ["Missing practical examples", "No case studies", "Lacks data visualization"],
              recommendations: ["Add real-world examples", "Include expert quotes", "Improve heading structure", "Add internal links"],
            };
          } else {
            brief = await geminiToolLoop({
              prompt: `Research competitors for the keyword "${jobAfterKeyword.detectedKeyword}". Search for top-ranking articles and analyze their strengths and weaknesses compared to: ${job.sourceUrl}\n\nReturn: competitors[] (url, title, strengths, weaknesses), contentGaps[], recommendations[].`,
              tools: [
                { name: "serpSearch", description: "Search Google", fn: async (args) => JSON.stringify(await serpSearch(args.query || jobAfterKeyword.detectedKeyword || "")) },
                { name: "scrape", description: "Scrape a URL", fn: async (args) => { const r = await scrape(args.url || ""); return r.markdown.slice(0, 3000); } },
              ],
              maxTurns: 5,
              finalSchema: CompetitorBriefSchema,
            });
          }
          await updateStepStatus(jobId, "competitorResearch", "succeeded", { competitorBriefJson: brief });
        } catch (err) {
          await updateStepStatus(jobId, "competitorResearch", "failed", {
            competitorResearchError: err instanceof Error ? err.message : String(err),
            failedStep: "competitorResearch",
            lastError: err instanceof Error ? err.message : String(err),
            status: "FAILED",
          });
          return;
        }
      }
    }

    const jobAfterCompetitors = await prisma.optimizationJob.findUnique({ where: { id: jobId } });
    if (!jobAfterCompetitors) return;

    // Step 4: Audit
    if (startIdx <= 3) {
      if (jobAfterCompetitors.auditStatus === "succeeded" && jobAfterCompetitors.auditMarkdown) {
        // Skip
      } else {
        await updateStepStatus(jobId, "audit", "running");
        try {
          let audit: string;
          if (isMockMode()) {
            audit = `# SEO Audit Report\n\n## Overall Score: 65/100\n\n## Keyword Analysis\n- **Target Keyword:** ${jobAfterCompetitors.detectedKeyword}\n- **Current Density:** 1.2%\n- **Recommended Density:** 1.5%\n\n## Content Quality\n- Word count: Adequate (1,200 words)\n- Readability: Good (Flesch-Kincaid: 8th grade)\n- Heading structure: Needs improvement\n\n## On-Page SEO Issues\n1. **High Priority:** Missing H1 tag optimization\n2. **High Priority:** Meta description too short\n3. **Medium Priority:** No internal links\n4. **Medium Priority:** Images missing alt text\n5. **Low Priority:** URL structure could be cleaner\n\n## Competitor Comparison\n${JSON.stringify(jobAfterCompetitors.competitorBriefJson, null, 2)}\n\n## Prioritized Recommendations\n1. Optimize H1 and meta tags for target keyword\n2. Add 3-5 internal links to relevant pages\n3. Expand content to 2,000+ words\n4. Add image alt text with keywords\n5. Improve heading hierarchy (H2/H3)\n6. Add FAQ section based on People Also Ask\n`;
          } else {
            audit = await claudeChat({
              system: "You are an expert SEO auditor. Produce detailed, actionable audit reports with scoring.",
              prompt: `Audit this content for SEO optimization:\n\nURL: ${job.sourceUrl}\nTarget Keyword: ${jobAfterCompetitors.detectedKeyword}\n\nContent:\n${(jobAfterCompetitors.scrapedMarkdown || "").slice(0, 5000)}\n\nCompetitor Analysis:\n${JSON.stringify(jobAfterCompetitors.competitorBriefJson)}\n\nProvide a comprehensive SEO audit in markdown format with:\n- Overall score (out of 100)\n- Keyword analysis\n- Content quality assessment\n- On-page SEO issues (prioritized)\n- Competitor comparison\n- Prioritized recommendations`,
              maxTokens: 4096,
            });
          }
          await updateStepStatus(jobId, "audit", "succeeded", { auditMarkdown: audit });
        } catch (err) {
          await updateStepStatus(jobId, "audit", "failed", {
            auditError: err instanceof Error ? err.message : String(err),
            failedStep: "audit",
            lastError: err instanceof Error ? err.message : String(err),
            status: "FAILED",
          });
          return;
        }
      }
    }

    const jobAfterAudit = await prisma.optimizationJob.findUnique({ where: { id: jobId } });
    if (!jobAfterAudit) return;

    // Step 5: Optimized Rewrite
    if (startIdx <= 4) {
      if (jobAfterAudit.rewriteStatus === "succeeded" && jobAfterAudit.optimizedRewriteMarkdown) {
        // Skip
      } else {
        await updateStepStatus(jobId, "rewrite", "running");
        try {
          let rewrite: string;
          if (isMockMode()) {
            rewrite = `# ${jobAfterAudit.detectedKeyword}: The Complete Guide\n\n## Introduction\n\nThis is the optimized version of the content from ${job.sourceUrl}. The content has been rewritten to address the issues identified in the SEO audit.\n\n## What is ${jobAfterAudit.detectedKeyword}?\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. This section provides a comprehensive overview of the topic, targeting the primary keyword naturally.\n\n## Key Strategies for ${jobAfterAudit.detectedKeyword}\n\n### Strategy 1: Optimize Your Approach\n\nDetailed explanation of the first strategy with practical examples and actionable tips.\n\n### Strategy 2: Leverage Best Practices\n\nIn-depth coverage of industry best practices, including data-driven insights.\n\n### Strategy 3: Measure and Iterate\n\nHow to track your progress and continuously improve your results.\n\n## Frequently Asked Questions\n\n### What is the best way to approach ${jobAfterAudit.detectedKeyword}?\n\nThe best approach involves understanding your audience, creating quality content, and following SEO best practices.\n\n### How long does it take to see results?\n\nTypically, you can expect to see initial results within 3-6 months of consistent effort.\n\n## Conclusion\n\nBy following these strategies and recommendations, you can significantly improve your performance in ${jobAfterAudit.detectedKeyword}. Remember to track your metrics and adjust your approach based on the data.\n`;
          } else {
            rewrite = await claudeChat({
              system: `You are an expert SEO content writer for ${job.brand.companyName}. Rewrite content implementing all audit recommendations.`,
              prompt: `Rewrite this content implementing the audit recommendations:\n\nOriginal Content:\n${(jobAfterAudit.scrapedMarkdown || "").slice(0, 4000)}\n\nTarget Keyword: ${jobAfterAudit.detectedKeyword}\n\nAudit Recommendations:\n${(jobAfterAudit.auditMarkdown || "").slice(0, 3000)}\n\nCompetitor Insights:\n${JSON.stringify(jobAfterAudit.competitorBriefJson)}\n\nRewrite the content as optimized markdown:\n- Implement all high and medium priority recommendations\n- Improve keyword usage and placement\n- Enhance heading structure\n- Add FAQ section if recommended\n- Improve readability and content depth\n- Naturally mention ${job.brand.companyName} where appropriate`,
              maxTokens: 8192,
            });
          }
          await updateStepStatus(jobId, "rewrite", "succeeded", { optimizedRewriteMarkdown: rewrite });
        } catch (err) {
          await updateStepStatus(jobId, "rewrite", "failed", {
            rewriteError: err instanceof Error ? err.message : String(err),
            failedStep: "rewrite",
            lastError: err instanceof Error ? err.message : String(err),
            status: "FAILED",
          });
          return;
        }
      }
    }

    // All steps complete
    await prisma.optimizationJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED" },
    });
  } catch (err) {
    await prisma.optimizationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        lastError: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
