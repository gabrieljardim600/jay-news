// Facebook Page posts via Graph API (páginas públicas).
// Funciona com page_id numérico ou com username (slug). Requer META_ACCESS_TOKEN.
import type { FetchedPost, FetchedProfile, SocialBrandMediaItem, SocialBrandPostKind } from "./types";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

function token(): string {
  const t = process.env.META_ACCESS_TOKEN || process.env.META_AD_LIBRARY_TOKEN;
  if (!t) throw new Error("META_ACCESS_TOKEN não configurado");
  return t;
}

interface FbPostRaw {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  attachments?: {
    data: Array<{
      type?: string;
      media?: { image?: { src?: string }; source?: string };
      subattachments?: { data: Array<{ media?: { image?: { src?: string } } }> };
    }>;
  };
}

function kindFromAttachment(p: FbPostRaw): SocialBrandPostKind {
  const t = p.attachments?.data?.[0]?.type;
  if (t === "video_inline" || t === "video_autoplay") return "video";
  return "post";
}

function mediaFromPost(p: FbPostRaw): SocialBrandMediaItem[] {
  const media: SocialBrandMediaItem[] = [];
  const att = p.attachments?.data?.[0];
  if (att) {
    if (att.media?.source) {
      media.push({ type: "video", url: att.media.source, thumbnail_url: att.media.image?.src });
    } else if (att.media?.image?.src) {
      media.push({ type: "image", url: att.media.image.src });
    }
    att.subattachments?.data?.forEach((sa) => {
      if (sa.media?.image?.src) media.push({ type: "image", url: sa.media.image.src });
    });
  }
  if (media.length === 0 && p.full_picture) {
    media.push({ type: "image", url: p.full_picture });
  }
  return media;
}

export async function fetchFacebookPage(
  identifier: string,
): Promise<{ profile: FetchedProfile; posts: FetchedPost[] }> {
  const clean = identifier.replace(/^@/, "").trim();
  const profileUrl = `${GRAPH_BASE}/${encodeURIComponent(clean)}?fields=id,name,about,fan_count,picture{url}&access_token=${encodeURIComponent(token())}`;
  const profRes = await fetch(profileUrl);
  const profData = await profRes.json();
  if (profData.error) {
    throw new Error(`Facebook Page profile: ${profData.error.message || JSON.stringify(profData.error)}`);
  }

  const profile: FetchedProfile = {
    identifier: clean,
    name: profData.name ?? clean,
    biography: profData.about ?? null,
    profile_picture_url: profData.picture?.data?.url ?? null,
    followers_count: profData.fan_count ?? 0,
    page_id: profData.id,
  };

  const fields = "id,message,created_time,permalink_url,full_picture,attachments{type,media,subattachments}";
  const postsUrl = `${GRAPH_BASE}/${encodeURIComponent(profData.id)}/posts?fields=${encodeURIComponent(fields)}&limit=50&access_token=${encodeURIComponent(token())}`;
  const postsRes = await fetch(postsUrl);
  const postsData = await postsRes.json();
  if (postsData.error) {
    throw new Error(`Facebook Page posts: ${postsData.error.message || JSON.stringify(postsData.error)}`);
  }

  const items: FbPostRaw[] = postsData.data ?? [];
  const posts: FetchedPost[] = items.map((p) => ({
    external_id: p.id,
    kind: kindFromAttachment(p),
    caption: p.message ?? null,
    permalink: p.permalink_url ?? null,
    posted_at: p.created_time ?? null,
    media: mediaFromPost(p),
    metrics: {},
    raw: p as unknown as Record<string, unknown>,
  }));

  return { profile, posts };
}
