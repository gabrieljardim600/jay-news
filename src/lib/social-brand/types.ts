export type SocialBrandPlatform = "instagram" | "facebook_page" | "meta_ads" | "tiktok";
export type SocialBrandMode = "news_only" | "archive_posts";
export type SocialBrandPostKind = "post" | "reel" | "video" | "story" | "ad";

export interface SocialBrandTarget {
  id: string;
  user_id: string;
  platform: SocialBrandPlatform;
  identifier: string;
  label: string;
  brand_key: string | null;
  niche: string | null;
  mode: SocialBrandMode;
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  profile: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SocialBrandMediaItem {
  type: "image" | "video";
  url: string;
  width?: number;
  height?: number;
  thumbnail_url?: string;
}

export interface SocialBrandPost {
  id: string;
  target_id: string;
  user_id: string;
  external_id: string;
  kind: SocialBrandPostKind;
  platform: SocialBrandPlatform;
  caption: string | null;
  permalink: string | null;
  posted_at: string | null;
  media: SocialBrandMediaItem[];
  archive: { storage_path: string; public_url: string; mime_type: string }[];
  metrics: Record<string, number>;
  raw: Record<string, unknown>;
  in_digest: boolean;
  fetched_at: string;
}

export interface FetchedPost {
  external_id: string;
  kind: SocialBrandPostKind;
  caption: string | null;
  permalink: string | null;
  posted_at: string | null;
  media: SocialBrandMediaItem[];
  metrics: Record<string, number>;
  raw: Record<string, unknown>;
}

export interface FetchedProfile {
  identifier: string;
  name?: string;
  biography?: string | null;
  profile_picture_url?: string | null;
  followers_count?: number;
  media_count?: number;
  page_id?: string;
}

export interface SyncReport {
  target_id: string;
  platform: SocialBrandPlatform;
  label: string;
  fetched: number;
  new_posts: number;
  archived: number;
  status: "ok" | "empty" | "error";
  error?: string;
}
