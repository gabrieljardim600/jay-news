import type { SocialPostInput } from "./types";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  image?: string;
  published_date?: string;
}

interface TavilyResponse {
  results: TavilyResult[];
}

/**
 * Best-effort Twitter/X fetch via Tavily. Quality depends on what Tavily indexed.
 * Returns recent posts attributed to the given handle.
 */
export async function fetchTwitterHandle(handle: string, limit: number = 10): Promise<SocialPostInput[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.error("TAVILY_API_KEY not set");
    return [];
  }
  const cleanHandle = handle.replace(/^@/, "").trim();

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        query: `from:${cleanHandle}`,
        max_results: limit,
        include_domains: ["twitter.com", "x.com"],
        topic: "general",
        days: 3,
        search_depth: "basic",
      }),
    });

    if (!res.ok) {
      console.error(`Tavily Twitter fetch failed for @${cleanHandle}: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as TavilyResponse;
    return (data.results || [])
      .filter((r) => /(twitter|x)\.com\//i.test(r.url))
      .map<SocialPostInput>((r) => {
        // Extract tweet id from URL when possible
        const idMatch = r.url.match(/status\/(\d+)/);
        const externalId = idMatch ? idMatch[1] : r.url;
        return {
          platform: "twitter",
          external_id: externalId,
          author: `@${cleanHandle}`,
          title: null,
          content: r.content || r.title || "",
          source_url: r.url,
          image_url: r.image || null,
          published_at: r.published_date || null,
          metadata: { source: "tavily" },
        };
      });
  } catch (err) {
    console.error(`Twitter fetch error for @${cleanHandle}:`, err);
    return [];
  }
}
