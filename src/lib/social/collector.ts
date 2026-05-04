import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialVoice, CrowdSource } from "@/types";
import type { SocialPostInput } from "./types";
import { fetchSubreddit, fetchRedditUser } from "./reddit";
import { fetchYouTubeChannel } from "./youtube";
import { fetchTwitterHandle } from "./twitter";

interface SourceReport {
  kind: "voice" | "crowd";
  label: string;
  platform: string;
  fetched: number;
  upserted: number;
  status: "ok" | "empty" | "error";
  error?: string;
}

interface CollectResult {
  voicesProcessed: number;
  crowdProcessed: number;
  postsUpserted: number;
  reports: SourceReport[];
  errors: string[];
}

export async function collectForUser(supabase: SupabaseClient, userId: string, accountId?: string | null): Promise<CollectResult> {
  const errors: string[] = [];
  const reports: SourceReport[] = [];

  const [voicesRes, crowdRes] = await Promise.all([
    supabase.from("social_voices").select("*").eq("user_id", userId).eq("is_active", true),
    supabase.from("crowd_sources").select("*").eq("user_id", userId).eq("is_active", true),
  ]);

  const voices: SocialVoice[] = voicesRes.data || [];
  const crowd: CrowdSource[] = crowdRes.data || [];

  const voiceFetches = await Promise.allSettled(
    voices.map(async (v) => ({ voice: v, posts: await fetchForVoice(v) }))
  );
  const crowdFetches = await Promise.allSettled(
    crowd.map(async (c) => ({ crowd: c, posts: await fetchForCrowd(c) }))
  );

  let upserted = 0;

  for (let i = 0; i < voiceFetches.length; i++) {
    const v = voices[i];
    const r = voiceFetches[i];
    if (r.status === "rejected") {
      reports.push({ kind: "voice", label: v.label, platform: v.platform, fetched: 0, upserted: 0, status: "error", error: String(r.reason).slice(0, 160) });
      errors.push(`voice ${v.label}: ${r.reason}`);
      continue;
    }
    const { posts } = r.value;
    if (posts.length === 0) {
      reports.push({ kind: "voice", label: v.label, platform: v.platform, fetched: 0, upserted: 0, status: "empty" });
      continue;
    }
    const rows = posts.map((p) => toRow(userId, accountId, p, { voice_id: v.id, crowd_source_id: null }));
    const { error, data } = await supabase
      .from("social_posts")
      .upsert(rows, { onConflict: "user_id,platform,external_id", ignoreDuplicates: false })
      .select("id");
    if (error) {
      reports.push({ kind: "voice", label: v.label, platform: v.platform, fetched: posts.length, upserted: 0, status: "error", error: error.message.slice(0, 160) });
      errors.push(`voice ${v.label}: ${error.message}`);
    } else {
      const n = data?.length || rows.length;
      reports.push({ kind: "voice", label: v.label, platform: v.platform, fetched: posts.length, upserted: n, status: "ok" });
      upserted += n;
    }
  }

  for (let i = 0; i < crowdFetches.length; i++) {
    const cs = crowd[i];
    const r = crowdFetches[i];
    if (r.status === "rejected") {
      reports.push({ kind: "crowd", label: cs.label, platform: cs.platform, fetched: 0, upserted: 0, status: "error", error: String(r.reason).slice(0, 160) });
      errors.push(`crowd ${cs.label}: ${r.reason}`);
      continue;
    }
    const { posts } = r.value;
    if (posts.length === 0) {
      reports.push({ kind: "crowd", label: cs.label, platform: cs.platform, fetched: 0, upserted: 0, status: "empty" });
      continue;
    }
    const rows = posts.map((p) => toRow(userId, accountId, p, { voice_id: null, crowd_source_id: cs.id }));
    const { error, data } = await supabase
      .from("social_posts")
      .upsert(rows, { onConflict: "user_id,platform,external_id", ignoreDuplicates: false })
      .select("id");
    if (error) {
      reports.push({ kind: "crowd", label: cs.label, platform: cs.platform, fetched: posts.length, upserted: 0, status: "error", error: error.message.slice(0, 160) });
      errors.push(`crowd ${cs.label}: ${error.message}`);
    } else {
      const n = data?.length || rows.length;
      reports.push({ kind: "crowd", label: cs.label, platform: cs.platform, fetched: posts.length, upserted: n, status: "ok" });
      upserted += n;
    }
  }

  return {
    voicesProcessed: voices.length,
    crowdProcessed: crowd.length,
    postsUpserted: upserted,
    reports,
    errors,
  };
}

function toRow(userId: string, accountId: string | null | undefined, p: SocialPostInput, refs: { voice_id: string | null; crowd_source_id: string | null }) {
  return {
    user_id: userId,
    account_id: accountId ?? null,
    voice_id: refs.voice_id,
    crowd_source_id: refs.crowd_source_id,
    platform: p.platform,
    external_id: p.external_id,
    author: p.author,
    title: p.title || null,
    content: p.content,
    source_url: p.source_url,
    image_url: p.image_url || null,
    published_at: p.published_at || null,
    metadata: p.metadata || {},
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
      return [];
    default:
      return [];
  }
}

/**
 * Account-scoped variant: lista voices/crowd via `account_id`, mantendo o
 * `user_id` original de cada row no upsert (a unique key e
 * `user_id,platform,external_id`). Usado pelo endpoint v1 e pelo cron.
 */
export async function collectForAccount(
  supabase: SupabaseClient,
  accountId: string,
): Promise<CollectResult> {
  const errors: string[] = [];
  const reports: SourceReport[] = [];

  const [voicesRes, crowdRes] = await Promise.all([
    supabase
      .from("social_voices")
      .select("*")
      .eq("account_id", accountId)
      .eq("is_active", true),
    supabase
      .from("crowd_sources")
      .select("*")
      .eq("account_id", accountId)
      .eq("is_active", true),
  ]);

  const voices: SocialVoice[] = voicesRes.data || [];
  const crowd: CrowdSource[] = crowdRes.data || [];

  let upserted = 0;

  // Voices em paralelo
  const voiceFetches = await Promise.allSettled(
    voices.map(async (v) => ({ voice: v, posts: await fetchForVoice(v) })),
  );
  for (let i = 0; i < voiceFetches.length; i++) {
    const v = voices[i];
    const r = voiceFetches[i];
    if (r.status === "rejected") {
      reports.push({ kind: "voice", label: v.label, platform: v.platform, fetched: 0, upserted: 0, status: "error", error: String(r.reason).slice(0, 160) });
      errors.push(`voice ${v.label}: ${r.reason}`);
      continue;
    }
    const { posts } = r.value;
    if (posts.length === 0) {
      reports.push({ kind: "voice", label: v.label, platform: v.platform, fetched: 0, upserted: 0, status: "empty" });
      continue;
    }
    const rows = posts.map((p) =>
      toRow(v.user_id, accountId, p, { voice_id: v.id, crowd_source_id: null }),
    );
    const { error, data } = await supabase
      .from("social_posts")
      .upsert(rows, { onConflict: "user_id,platform,external_id", ignoreDuplicates: false })
      .select("id");
    if (error) {
      reports.push({ kind: "voice", label: v.label, platform: v.platform, fetched: posts.length, upserted: 0, status: "error", error: error.message.slice(0, 160) });
      errors.push(`voice ${v.label}: ${error.message}`);
    } else {
      const n = data?.length || rows.length;
      reports.push({ kind: "voice", label: v.label, platform: v.platform, fetched: posts.length, upserted: n, status: "ok" });
      upserted += n;
    }
  }

  // Crowd em paralelo
  const crowdFetches = await Promise.allSettled(
    crowd.map(async (c) => ({ crowd: c, posts: await fetchForCrowd(c) })),
  );
  for (let i = 0; i < crowdFetches.length; i++) {
    const cs = crowd[i];
    const r = crowdFetches[i];
    if (r.status === "rejected") {
      reports.push({ kind: "crowd", label: cs.label, platform: cs.platform, fetched: 0, upserted: 0, status: "error", error: String(r.reason).slice(0, 160) });
      errors.push(`crowd ${cs.label}: ${r.reason}`);
      continue;
    }
    const { posts } = r.value;
    if (posts.length === 0) {
      reports.push({ kind: "crowd", label: cs.label, platform: cs.platform, fetched: 0, upserted: 0, status: "empty" });
      continue;
    }
    const rows = posts.map((p) =>
      toRow(cs.user_id, accountId, p, { voice_id: null, crowd_source_id: cs.id }),
    );
    const { error, data } = await supabase
      .from("social_posts")
      .upsert(rows, { onConflict: "user_id,platform,external_id", ignoreDuplicates: false })
      .select("id");
    if (error) {
      reports.push({ kind: "crowd", label: cs.label, platform: cs.platform, fetched: posts.length, upserted: 0, status: "error", error: error.message.slice(0, 160) });
      errors.push(`crowd ${cs.label}: ${error.message}`);
    } else {
      const n = data?.length || rows.length;
      reports.push({ kind: "crowd", label: cs.label, platform: cs.platform, fetched: posts.length, upserted: n, status: "ok" });
      upserted += n;
    }
  }

  return {
    voicesProcessed: voices.length,
    crowdProcessed: crowd.length,
    postsUpserted: upserted,
    reports,
    errors,
  };
}
