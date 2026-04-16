import type { SocialPostInput } from "./types";

interface RedditChild {
  kind: string;
  data: {
    id: string;
    title: string;
    selftext?: string;
    author: string;
    permalink: string;
    url: string;
    created_utc: number;
    score: number;
    num_comments: number;
    stickied?: boolean;
    over_18?: boolean;
    thumbnail?: string;
    subreddit: string;
  };
}

interface RedditListing {
  data: { children: RedditChild[] };
}

/** Fetch hot posts from a subreddit via public JSON. No auth needed. */
export async function fetchSubreddit(identifier: string, limit: number = 15): Promise<SocialPostInput[]> {
  const sub = identifier.replace(/^r\//i, "").trim();
  const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/hot.json?limit=${limit}&raw_json=1`;
  try {
    // Reddit blocks generic/cloud UAs. Use a browser-ish UA to be safe.
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JNews/1.0; +https://jay-news.vercel.app)",
        "Accept": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`Reddit fetch failed for r/${sub}: ${res.status}`);
      return [];
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) {
      console.error(`Reddit returned non-JSON for r/${sub}: ${ct}`);
      return [];
    }
    const data = (await res.json()) as RedditListing;
    return (data.data?.children || [])
      .map((c) => c.data)
      .filter((p) => !p.stickied && !p.over_18)
      .map<SocialPostInput>((p) => {
        const snippet = p.selftext ? p.selftext.replace(/\s+/g, " ").trim().slice(0, 600) : "";
        return {
          platform: "reddit",
          external_id: p.id,
          author: `u/${p.author}`,
          title: p.title,
          content: snippet || p.title,
          source_url: `https://www.reddit.com${p.permalink}`,
          image_url: p.thumbnail && p.thumbnail.startsWith("http") ? p.thumbnail : null,
          published_at: new Date(p.created_utc * 1000).toISOString(),
          metadata: {
            score: p.score,
            comments: p.num_comments,
            subreddit: p.subreddit,
            link: p.url,
          },
        };
      });
  } catch (err) {
    console.error(`Reddit fetch error for r/${sub}:`, err);
    return [];
  }
}

/** Fetch posts authored by a specific reddit user. */
export async function fetchRedditUser(handle: string, limit: number = 10): Promise<SocialPostInput[]> {
  const user = handle.replace(/^u\//i, "").replace(/^@/, "").trim();
  const url = `https://www.reddit.com/user/${encodeURIComponent(user)}/submitted.json?limit=${limit}&raw_json=1`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JNews/1.0; +https://jay-news.vercel.app)",
        "Accept": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return [];
    const data = (await res.json()) as RedditListing;
    return (data.data?.children || [])
      .map((c) => c.data)
      .map<SocialPostInput>((p) => ({
        platform: "reddit_user",
        external_id: p.id,
        author: `u/${p.author}`,
        title: p.title,
        content: (p.selftext || p.title).slice(0, 600),
        source_url: `https://www.reddit.com${p.permalink}`,
        image_url: null,
        published_at: new Date(p.created_utc * 1000).toISOString(),
        metadata: { score: p.score, comments: p.num_comments, subreddit: p.subreddit },
      }));
  } catch {
    return [];
  }
}
