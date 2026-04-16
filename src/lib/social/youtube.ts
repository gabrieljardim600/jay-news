import Parser from "rss-parser";
import type { SocialPostInput } from "./types";

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "JNews/1.0" },
});

/**
 * Resolve a user-supplied YouTube identifier into a channel ID (UC...).
 * Accepts: full URL, @handle, channel ID, or bare username.
 * Falls back to scraping the channel page for the canonical channel ID.
 */
async function resolveChannelId(handle: string): Promise<string | null> {
  const trimmed = handle.trim();

  // Already a channel ID
  if (/^UC[\w-]{20,}$/.test(trimmed)) return trimmed;

  // Channel-ID URL
  const idMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (idMatch) return idMatch[1];

  // Build a candidate URL to scrape
  let candidate: string;
  if (/^https?:\/\//.test(trimmed)) {
    candidate = trimmed;
  } else if (trimmed.startsWith("@")) {
    candidate = `https://www.youtube.com/${trimmed}`;
  } else {
    candidate = `https://www.youtube.com/@${trimmed.replace(/^@/, "")}`;
  }

  try {
    const res = await fetch(candidate, {
      headers: { "User-Agent": "Mozilla/5.0 JNews/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/"channelId":"(UC[\w-]+)"/) || html.match(/channel\/(UC[\w-]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export async function fetchYouTubeChannel(handle: string, limit: number = 10): Promise<SocialPostInput[]> {
  const channelId = await resolveChannelId(handle);
  if (!channelId) {
    console.warn(`YouTube: could not resolve channel for "${handle}"`);
    return [];
  }

  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  try {
    const feed = await parser.parseURL(feedUrl);
    return (feed.items || []).slice(0, limit).map<SocialPostInput>((item) => {
      const raw = item as Record<string, unknown>;
      const mediaGroup = raw["media:group"] as Record<string, unknown> | undefined;
      const mediaThumb = mediaGroup?.["media:thumbnail"] as Record<string, Record<string, string>> | undefined;
      const mediaDescription = mediaGroup?.["media:description"];
      const description =
        typeof mediaDescription === "string"
          ? mediaDescription
          : Array.isArray(mediaDescription)
          ? String(mediaDescription[0] || "")
          : "";

      // Video ID lives in `id` as `yt:video:VIDEO_ID`
      const externalId = (item.id || item.guid || item.link || "").toString().split(":").pop() || item.link || "";

      return {
        platform: "youtube",
        external_id: externalId,
        author: feed.title || "YouTube",
        title: item.title || null,
        content: description.slice(0, 800) || item.title || "",
        source_url: item.link || feedUrl,
        image_url: mediaThumb?.["$"]?.url || null,
        published_at: item.isoDate || null,
        metadata: { channel_id: channelId, channel_title: feed.title },
      };
    });
  } catch (err) {
    console.error(`YouTube RSS fetch failed for ${channelId}:`, err);
    return [];
  }
}
