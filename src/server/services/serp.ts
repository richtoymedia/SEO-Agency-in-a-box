const SERP_API_URL = "https://serpapi.com/search.json";

function isMockMode(): boolean {
  return !process.env.SERPAPI_API_KEY;
}

export interface SerpResult {
  organic: Array<{ title: string; url: string; snippet: string }>;
  peopleAlsoAsk: string[];
  relatedSearches: string[];
}

export async function serpSearch(query: string): Promise<SerpResult> {
  if (isMockMode()) {
    return {
      organic: [
        { title: `Top Result for "${query}"`, url: "https://example.com/1", snippet: "This is a mock search result providing relevant information about the topic." },
        { title: `Guide to ${query}`, url: "https://example.com/2", snippet: "Comprehensive guide covering all aspects of the topic." },
        { title: `${query} Best Practices`, url: "https://example.com/3", snippet: "Industry best practices and expert recommendations." },
      ],
      peopleAlsoAsk: [
        `What is ${query}?`,
        `How does ${query} work?`,
        `Why is ${query} important?`,
      ],
      relatedSearches: [
        `${query} tutorial`,
        `${query} examples`,
        `best ${query} tools`,
      ],
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const params = new URLSearchParams({
      q: query,
      api_key: process.env.SERPAPI_API_KEY!,
      engine: "google",
    });

    const res = await fetch(`${SERP_API_URL}?${params}`, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`SerpAPI error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return {
      organic: (data.organic_results || []).slice(0, 10).map((r: Record<string, string>) => ({
        title: r.title || "",
        url: r.link || "",
        snippet: r.snippet || "",
      })),
      peopleAlsoAsk: (data.related_questions || []).map((q: Record<string, string>) => q.question || ""),
      relatedSearches: (data.related_searches || []).map((s: Record<string, string>) => s.query || ""),
    };
  } finally {
    clearTimeout(timeout);
  }
}
