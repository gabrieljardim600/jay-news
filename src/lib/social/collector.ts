import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialVoice, CrowdSource } from "@/types";
import type { SocialPostInput } from "./types";
import { fetchSubreddit, fetchRedditUser } from "./reddit";
import { fetchYouTubeChannel } from "./youtube";
import { fetchTwitterHandle } from "./twitter";

interface CollectResult {
  voicesProcessed: number;
  crowdProcessed: number;
  postsUpserted: number;
  errors: string[];
}

export async function collectForUser(supabase: SupabaseClient, userId: string): Promise<CollectResult> {
  const errors: string[] = [];

  const [voicesRes, crowdRes] = await Promise.all([
    supabase.from("social_voices").select("*").eq("user_id", userId).eq("is_active", true),
    supabase.from("crowd_sources").select("*").eq("user_id", userId).eq("is_active", true),
  ]);

  const voices: SocialVoice[] = voicesRes.data || [];
  const crowd: CrowdSource[] = crowdRes.data || [];

  // Voices
  const voiceFetches = await Promise.allSettled(
    voices.map(async (v) => {
      const posts = await fetchForVoice(v);
      return { voice: v, posts };
    })
  );

  // Crowd
  const crowdFetches = await Promise.allSettled(
    crowd.map(async (c) => {
      const posts = await fetchForCrowd(c);
      return { crowd: c, posts };
    })
  );

  let upserted = 0;

  for (const r of voiceFetches) {
    if (r.status === "rejected") {
      errors.push(`voice: ${r.reason}`);
      continue;
    }
    const { voice, posts } = r.value;
    if (posts.length === 0) continue;
    const rows = posts.map((p) => ({
      user_id: userId,
      voice_id: voice.id,
      crowd_source_id: null,
      platform: p.platform,
      external_id: p.external_id,
      author: p.author,
      title: p.title || null,
      content: p.content,
      source_url: p.source_url,
      image_url: p.image_url || null,
      published_at: p.published_at || null,
      metadata: p.metadata || {},
    }));
    const { error } = await supabase.from("social_posts").upsert(rows, {
      onConflict: "user_id,platform,external_id",
      ignoreDuplicates: false,
    });
    if (error) errors.push(`voice ${voice.label}: ${error.message}`);
    else upserted += rows.length;
  }

  for (const r of crowdFetches) {
    if (r.status === "rejected") {
      errors.push(`crowd: ${r.reason}`);
      continue;
    }
    const { crowd: cs, posts } = r.value;
    if (posts.length === 0) continue;
    const rows = posts.map((p) => ({
      user_id: userId,
      voice_id: null,
      crowd_source_id: cs.id,
      platform: p.platform,
      external_id: p.external_id,
      author: p.author,
      title: p.title || null,
      content: p.content,
      source_url: p.source_url,
      image_url: p.image_url || null,
      published_at: p.published_at || null,
      metadata: p.metadata || {},
    }));
    const { error } = await supabase.from("social_posts").upsert(rows, {
      onConflict: "user_id,platform,external_id",
      ignoreDuplicates: false,
    });
    if (error) errors.push(`crowd ${cs.label}: ${error.message}`);
    else upserted += rows.length;
  }

  return {
    voicesProcessed: voices.length,
    crowdProcessed: crowd.length,
    postsUpserted: upserted,
    errors,
  };
}

async function fetchForVoice(v: SocialVoice): Promise<SocialPostInput[]> {
  switch (v.platform) {
    case "twitter":
      return fetchTwitterHandle(v.handle, 10);
    case "youtube":
      return fetchYouTubeChannel(v.handle, 10);
    case "reddit_user":
      return fetchRedditUser(v.handle, 10);
    default:
      return [];
  }
}

async function fetchForCrowd(c: CrowdSource): Promise<SocialPostInput[]> {
  switch (c.platform) {
    case "reddit":
      return fetchSubreddit(c.identifier, 15);
    case "stocktwits":
      return []; // deferred
    default:
      return [];
  }
}
