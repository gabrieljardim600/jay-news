import { fetchYouTubeChannel } from "@/lib/social/youtube";
import type { GossipPostInput, GossipSource } from "../types";

export async function fetchGossipYoutube(source: GossipSource): Promise<GossipPostInput[]> {
  const posts = await fetchYouTubeChannel(source.handle);
  return posts.map((p) => ({
    source_id: source.id,
    platform: "youtube" as const,
    external_id: p.external_id,
    url: p.source_url,
    author: p.author ?? source.label,
    title: p.title ?? null,
    body: p.content,
    image_url: p.image_url ?? null,
    published_at: p.published_at ?? new Date().toISOString(),
    raw: p.metadata ?? null,
  }));
}
