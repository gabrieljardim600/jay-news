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
    // Aceita só tweet canonical do handle. Rejeita sub-paths tipo /media_tags,
    // /photo, /video — são páginas auxiliares que Tavily às vezes retorna e
    // não refletem a data real do tweet principal.
    const handleStatusRegex = new RegExp(
      `^https?://(?:twitter|x)\\.com/${cleanHandle}/status/(\\d+)(?:[/?#]?$|[?#])`,
      "i"
    );
    const maxAgeMs = 7 * 24 * 3600_000;
    const now = Date.now();
    const out: SocialPostInput[] = [];
    for (const r of data.results || []) {
      const m = r.url.match(handleStatusRegex);
      if (!m) continue;
      const tweetId = m[1];

      // Decoda o timestamp real do snowflake ID do tweet. Tavily nem sempre
      // devolve published_date confiável e às vezes cai em tweet antigo.
      let publishedAt: string | null = null;
      const twitterEpoch = BigInt("1288834974657");
      try {
        const idBig = BigInt(tweetId);
        const ms = Number((idBig >> BigInt(22)) + twitterEpoch);
        if (Number.isFinite(ms) && ms > 0 && ms < now + 3600_000) {
          publishedAt = new Date(ms).toISOString();
        }
      } catch {
        /* ignore */
      }
      if (!publishedAt && r.published_date) publishedAt = r.published_date;
      if (!publishedAt) continue; // sem data confiável → descarta

      const ageMs = now - new Date(publishedAt).getTime();
      if (Number.isFinite(ageMs) && ageMs > maxAgeMs) continue; // tweet antigo

      out.push({
        platform: "twitter",
        external_id: tweetId,
        author: `@${cleanHandle}`,
        title: null,
        content: r.content || r.title || "",
        source_url: `https://x.com/${cleanHandle}/status/${tweetId}`,
        image_url: r.image || null,
        published_at: publishedAt,
        metadata: { source: "tavily" },
      });
    }
    return out;
  } catch (err) {
    console.error(`Twitter fetch error for @${cleanHandle}:`, err);
    return [];
  }
}
