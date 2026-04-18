import { fetchTwitterHandle } from "@/lib/social/twitter";
import type { GossipPostInput, GossipSource } from "../types";

export async function fetchGossipTwitter(source: GossipSource): Promise<GossipPostInput[]> {
  const posts = await fetchTwitterHandle(source.handle);
  // Sem published_at real, rejeita — não queremos marcar tweet antigo como
  // "hoje" só porque o scraper não devolveu data.
  return posts
    .filter((p) => !!p.published_at)
    .map((p) => ({
      source_id: source.id,
      platform: "twitter" as const,
      external_id: p.external_id,
      url: p.source_url,
      author: p.author ?? source.label,
      title: p.title ?? null,
      body: p.content,
      image_url: p.image_url ?? null,
      published_at: p.published_at!,
      raw: p.metadata ?? null,
    }));
}
