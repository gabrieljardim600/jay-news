import Parser from "rss-parser";
import type { RawArticle } from "@/types";

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "JNews/1.0" },
});

export async function fetchRssFeed(url: string, sourceName: string): Promise<RawArticle[]> {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items || []).slice(0, 20).map((item) => ({
      title: item.title || "Sem titulo",
      url: item.link || url,
      content: item.contentSnippet || item.content || "",
      source_name: sourceName,
      image_url: item.enclosure?.url || undefined,
      published_at: item.isoDate || undefined,
    }));
  } catch (error) {
    console.error(`RSS fetch failed for ${sourceName} (${url}):`, error);
    return [];
  }
}

export async function fetchAllRssFeeds(sources: { url: string; name: string }[]): Promise<RawArticle[]> {
  const results = await Promise.allSettled(sources.map((s) => fetchRssFeed(s.url, s.name)));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
