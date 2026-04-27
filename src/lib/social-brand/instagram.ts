// Instagram Business Discovery — porte do jayprompter, adaptado para jay-news.
// Requer:
//   META_ACCESS_TOKEN     — token long-lived do system user
//   META_PIVOT_IG_ID      — IG Business Account ID que está autenticado pela app
import type { FetchedPost, FetchedProfile, SocialBrandMediaItem, SocialBrandPostKind } from "./types";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const PAGE_LIMIT = 50;
const MAX_PAGES = 3;

function safeCaption(raw: unknown, max = 1000): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const trimmed = Array.from(raw).slice(0, max).join("");
  return (
    trimmed.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "") || null
  );
}

const MEDIA_FIELDS = [
  "id",
  "caption",
  "media_url",
  "thumbnail_url",
  "media_type",
  "media_product_type",
  "permalink",
  "timestamp",
  "like_count",
  "comments_count",
  "children{id,media_url,thumbnail_url,media_type}",
].join(",");

function token(): string {
  const t = process.env.META_ACCESS_TOKEN || process.env.META_AD_LIBRARY_TOKEN;
  if (!t) throw new Error("META_ACCESS_TOKEN não configurado");
  return t;
}

function pivotId(): string {
  return process.env.META_PIVOT_IG_ID || "17841427301178173";
}

interface IgMediaRaw {
  id: string;
  caption?: string;
  media_url?: string;
  thumbnail_url?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  children?: { data: Array<{ id: string; media_url?: string; thumbnail_url?: string; media_type?: string }> };
}

function kindFromMedia(m: IgMediaRaw): SocialBrandPostKind {
  if (m.media_product_type === "REELS") return "reel";
  if (m.media_product_type === "STORY") return "story";
  if (m.media_type === "VIDEO") return "video";
  return "post";
}

function mediaArrayFor(m: IgMediaRaw): SocialBrandMediaItem[] {
  if (m.media_type === "CAROUSEL_ALBUM" && m.children?.data?.length) {
    return m.children.data
      .map((c): SocialBrandMediaItem => ({
        type: c.media_type === "VIDEO" ? "video" : "image",
        url: c.media_url ?? c.thumbnail_url ?? "",
        thumbnail_url: c.thumbnail_url,
      }))
      .filter((x) => x.url);
  }
  const url = m.media_url ?? m.thumbnail_url;
  if (!url) return [];
  return [{
    type: m.media_type === "VIDEO" ? "video" : "image",
    url,
    thumbnail_url: m.thumbnail_url,
  }];
}

function normalizePost(m: IgMediaRaw): FetchedPost {
  return {
    external_id: m.id,
    kind: kindFromMedia(m),
    caption: safeCaption(m.caption),
    permalink: m.permalink ?? null,
    posted_at: m.timestamp ?? null,
    media: mediaArrayFor(m),
    metrics: {
      likes: m.like_count ?? 0,
      comments: m.comments_count ?? 0,
    },
    raw: m as unknown as Record<string, unknown>,
  };
}

export async function fetchInstagramProfile(
  username: string,
): Promise<{ profile: FetchedProfile; posts: FetchedPost[] }> {
  const clean = username.replace("@", "").trim().toLowerCase();
  const profileFields = [
    "id",
    "username",
    "name",
    "biography",
    "profile_picture_url",
    "followers_count",
    "media_count",
    `media.limit(${PAGE_LIMIT}){${MEDIA_FIELDS}}`,
  ].join(",");

  const fields = `business_discovery.username(${clean}){${profileFields}}`;
  const url = `${GRAPH_BASE}/${pivotId()}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token())}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(`Instagram Business Discovery: ${data.error.message || JSON.stringify(data.error)}`);
  }
  if (!data.business_discovery) {
    throw new Error(`Perfil "${clean}" não encontrado ou não é uma conta Business/Creator pública.`);
  }

  const bd = data.business_discovery;
  const accountId: string = bd.id;

  const profile: FetchedProfile = {
    identifier: clean,
    name: bd.name ?? clean,
    biography: bd.biography ?? null,
    profile_picture_url: bd.profile_picture_url ?? null,
    followers_count: bd.followers_count ?? 0,
    media_count: bd.media_count ?? 0,
    page_id: accountId,
  };

  const posts: FetchedPost[] = (bd.media?.data ?? []).map((m: IgMediaRaw) => normalizePost(m));

  let nextCursor: string | null = bd.media?.paging?.cursors?.after ?? null;
  let page = 1;
  while (nextCursor && page < MAX_PAGES) {
    const pageUrl =
      `${GRAPH_BASE}/${accountId}/media` +
      `?fields=${encodeURIComponent(MEDIA_FIELDS)}` +
      `&limit=${PAGE_LIMIT}` +
      `&after=${encodeURIComponent(nextCursor)}` +
      `&access_token=${encodeURIComponent(token())}`;
    const pr = await fetch(pageUrl);
    const pd = await pr.json();
    if (pd.error || !Array.isArray(pd.data)) break;
    pd.data.forEach((m: IgMediaRaw) => posts.push(normalizePost(m)));
    nextCursor = pd.paging?.cursors?.after ?? null;
    page++;
  }

  return { profile, posts };
}
