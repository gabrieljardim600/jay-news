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

// ─── OAuth (app-only, client_credentials) ─────────────────────────────────
// Reddit bloqueia o public JSON do IP de clouds (Vercel/etc) com 403. A
// solucao oficial e gratuita: criar um "script" app em
// https://www.reddit.com/prefs/apps e usar app-only OAuth. Endpoints sob
// `oauth.reddit.com` aceitam o Bearer token mesmo de IPs cloud.
//
// Setar no env: REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET (+ opcional REDDIT_USER_AGENT).
// Se as envs nao existirem, fazemos fallback pro public JSON (so funciona local).

const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT || "JNews/1.0 (by jay-news.vercel.app)";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getRedditAccessToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const r = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": REDDIT_USER_AGENT,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!r.ok) {
    console.error(`Reddit OAuth token fetch failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return null;
  }
  const j = (await r.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) return null;
  const ttlMs = (j.expires_in ?? 3600) * 1000;
  cachedToken = { value: j.access_token, expiresAt: Date.now() + ttlMs };
  return j.access_token;
}

/**
 * Faz GET autenticado contra oauth.reddit.com quando ha credenciais; senao
 * tenta o public JSON em www.reddit.com (vai falhar em IPs cloud).
 */
async function redditGet(path: string): Promise<Response> {
  const token = await getRedditAccessToken();
  if (token) {
    return fetch(`https://oauth.reddit.com${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": REDDIT_USER_AGENT,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  }
  return fetch(`https://www.reddit.com${path}`, {
    headers: {
      "User-Agent": REDDIT_USER_AGENT,
      Accept: "application/json",
    },
    cache: "no-store",
  });
}

/** Fetch hot posts from a subreddit. Prefers OAuth when configured. */
export async function fetchSubreddit(identifier: string, limit: number = 15): Promise<SocialPostInput[]> {
  const sub = identifier.replace(/^r\//i, "").trim();
  const path = `/r/${encodeURIComponent(sub)}/hot.json?limit=${limit}&raw_json=1`;
  try {
    const res = await redditGet(path);
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
  const path = `/user/${encodeURIComponent(user)}/submitted.json?limit=${limit}&raw_json=1`;
  try {
    const res = await redditGet(path);
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
