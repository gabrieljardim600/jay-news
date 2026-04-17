import { fetchSubreddit, fetchRedditUser } from "@/lib/social/reddit";
import type { GossipPostInput, GossipSource } from "../types";

export async function fetchGossipReddit(source: GossipSource): Promise<GossipPostInput[]> {
  const handle = source.handle.trim();
  const posts = handle.toLowerCase().startsWith("u/")
    ? await fetchRedditUser(handle.slice(2))
    : await fetchSubreddit(handle.replace(/^r\//i, ""));

  return posts.map((p) => ({
    source_id: source.id,
    platform: "reddit" as const,
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
