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

export async function searchTavily(query: string, maxResults: number = 5): Promise<RawArticle[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.error("TAVILY_API_KEY not set");
    return [];
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: "basic",
        include_answer: false,
      }),
    });

    if (!response.ok) {
      console.error(`Tavily search failed: ${response.status}`);
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

export async function searchAllTopics(queries: { query: string; maxResults?: number }[]): Promise<RawArticle[]> {
  const results = await Promise.allSettled(queries.map((q) => searchTavily(q.query, q.maxResults || 5)));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
