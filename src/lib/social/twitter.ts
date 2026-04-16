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
    // Only keep URLs that are an actual tweet BY this handle: <site>/<handle>/status/<id>
    const handleStatusRegex = new RegExp(`^https?://(?:twitter|x)\\.com/${cleanHandle}/status/(\\d+)`, "i");
    const out: SocialPostInput[] = [];
    for (const r of data.results || []) {
      const m = r.url.match(handleStatusRegex);
      if (!m) continue;
      out.push({
        platform: "twitter",
        external_id: m[1],
        author: `@${cleanHandle}`,
        title: null,
        content: r.content || r.title || "",
        source_url: r.url,
        image_url: r.image || null,
        published_at: r.published_date || null,
        metadata: { source: "tavily" },
      });
    }
    return out;
  } catch (err) {
    console.error(`Twitter fetch error for @${cleanHandle}:`, err);
    return [];
  }
}
