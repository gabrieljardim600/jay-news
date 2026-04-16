/** Normalized shape returned by every fetcher. The collector upserts these into social_posts. */
export interface SocialPostInput {
  platform: string;
  external_id: string;
  author: string;
  title?: string | null;
  content: string;
  source_url: string;
  image_url?: string | null;
  published_at?: string | null;
  metadata?: Record<string, unknown>;
}
