import type { RawArticle } from "@/types";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
}

interface TavilyResponse {
  results: TavilyResult[];
}

export async function searchTavily(
  query: string,
  maxResults: number = 5,
  includeDomains?: string[],
  searchDepth: "basic" | "advanced" = "basic"
): Promise<RawArticle[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.error("TAVILY_API_KEY not set");
    return [];
  }

  try {
    const body: Record<string, unknown> = {
      query,
      max_results: maxResults,
      search_depth: searchDepth,
      include_answer: false,
      topic: "news",
    };
    if (includeDomains && includeDomains.length > 0) {
      body.include_domains = includeDomains;
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`Tavily search failed: ${response.status} — ${errText.slice(0, 200)}`);
      return [];
    }

    const data: TavilyResponse = await response.json();
    return data.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      source_name: new URL(r.url).hostname.replace("www.", ""),
      published_at: r.published_date || undefined,
    }));
  } catch (error) {
    console.error("Tavily search error:", error);
    return [];
  }
}

export async function searchAllTopics(
  queries: { query: string; maxResults?: number; includeDomains?: string[]; searchDepth?: "basic" | "advanced" }[]
): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    queries.map((q) => searchTavily(q.query, q.maxResults || 5, q.includeDomains, q.searchDepth || "basic"))
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
