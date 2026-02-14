const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1/scrape";

function isMockMode(): boolean {
  return !process.env.FIRECRAWL_API_KEY;
}

export async function scrape(url: string): Promise<{ markdown: string }> {
  if (isMockMode()) {
    return {
      markdown: `# Mock Scraped Content from ${url}\n\nThis is mock scraped content for development purposes.\n\n## Key Points\n\n- Point one about the topic\n- Point two with supporting details\n- Point three with expert insights\n\n## Detailed Analysis\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. This content simulates what would be scraped from the target URL in production.\n\n## Conclusion\n\nThe scraped content provides valuable insights for SEO optimization and content creation.`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(FIRECRAWL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({ url, formats: ["markdown"] }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Firecrawl error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return { markdown: data.data?.markdown || data.markdown || "" };
  } finally {
    clearTimeout(timeout);
  }
}
