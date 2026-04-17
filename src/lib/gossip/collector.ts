import type { SupabaseClient } from "@supabase/supabase-js";
import type { GossipSource, GossipPostInput, GossipTopic } from "./types";
import { fetchGossipRss } from "./fetchers/rss";
import { fetchGossipTwitter } from "./fetchers/twitter";
import { fetchGossipYoutube } from "./fetchers/youtube";
import { fetchGossipReddit } from "./fetchers/reddit";
import {
  matchByAliases,
  matchByClaude,
  hasProperNouns,
  persistMatches,
  type MatchResult,
} from "./matcher";

const CLAUDE_CALL_CAP_PER_COLLECT = 20;

export interface SourceReport {
  source_id: string;
  label: string;
  count: number;
  status: "ok" | "error";
  error?: string;
}

export interface CollectReport {
  fetched: number;
  inserted: number;
  errors: string[];
  bySource: SourceReport[];
  insertedPostIds: string[];
  matchesCreated?: number;
}

export async function collectGossipForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<CollectReport> {
  const { data: sources, error } = await supabase
    .from("gossip_sources")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true);

  if (error) throw error;

  const bySource: SourceReport[] = [];
  const errors: string[] = [];
  const insertedPostIds: string[] = [];
  let fetched = 0;
  let inserted = 0;

  const sourceById = new Map<string, GossipSource>();
  for (const src of (sources ?? []) as GossipSource[]) {
    sourceById.set(src.id, src);
    try {
      const posts = await fetchForSource(src);
      fetched += posts.length;
      const { addedIds } = await upsertPosts(supabase, userId, posts);
      inserted += addedIds.length;
      insertedPostIds.push(...addedIds);
      bySource.push({ source_id: src.id, label: src.label, count: addedIds.length, status: "ok" });
      await supabase
        .from("gossip_sources")
        .update({ last_fetched_at: new Date().toISOString() })
        .eq("id", src.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${src.label}: ${msg}`);
      bySource.push({ source_id: src.id, label: src.label, count: 0, status: "error", error: msg });
    }
  }

  let matchesCreated = 0;
  if (insertedPostIds.length > 0) {
    try {
      matchesCreated = await runMatchingForInsertedPosts(
        supabase,
        userId,
        insertedPostIds,
        sourceById,
        errors
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`matching: ${msg}`);
    }
  }

  return { fetched, inserted, errors, bySource, insertedPostIds, matchesCreated };
}

async function runMatchingForInsertedPosts(
  supabase: SupabaseClient,
  userId: string,
  insertedPostIds: string[],
  sourceById: Map<string, GossipSource>,
  errors: string[]
): Promise<number> {
  const { data: topicRows, error: topicErr } = await supabase
    .from("gossip_topics")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true);
  if (topicErr) throw topicErr;
  const topics = (topicRows ?? []) as GossipTopic[];
  if (topics.length === 0) return 0;

  const { data: postRows, error: postErr } = await supabase
    .from("gossip_posts")
    .select("id, title, body, source_id")
    .in("id", insertedPostIds);
  if (postErr) throw postErr;

  const posts = (postRows ?? []) as Array<{
    id: string;
    title: string | null;
    body: string | null;
    source_id: string;
  }>;

  const allMatches: MatchResult[] = [];
  const aliasMatchedPostIds = new Set<string>();
  for (const p of posts) {
    const ms = matchByAliases({ id: p.id, title: p.title, body: p.body }, topics);
    if (ms.length > 0) aliasMatchedPostIds.add(p.id);
    allMatches.push(...ms);
  }

  // Camada 2 (Claude) — apenas para posts de fontes proxy/aggregator, sem match camada 1,
  // e que contêm prováveis nomes próprios. Capped para evitar blow-up de custo.
  let claudeCalls = 0;
  let capExceeded = false;
  for (const p of posts) {
    if (aliasMatchedPostIds.has(p.id)) continue;
    const src = sourceById.get(p.source_id);
    if (!src) continue;
    if (src.tier !== "proxy" && src.tier !== "aggregator") continue;
    const combined = `${p.title ?? ""} ${p.body ?? ""}`;
    if (!hasProperNouns(combined)) continue;

    if (claudeCalls >= CLAUDE_CALL_CAP_PER_COLLECT) {
      capExceeded = true;
      break;
    }

    try {
      claudeCalls++;
      const claudeMatches = await matchByClaude(
        { id: p.id, title: p.title, body: p.body },
        topics
      );
      allMatches.push(...claudeMatches);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`claude-matcher post ${p.id}: ${msg}`);
    }
  }

  if (capExceeded) {
    console.warn(
      `[gossip:collector] cap Claude atingido (${CLAUDE_CALL_CAP_PER_COLLECT}) — posts restantes sem classificação camada 2`
    );
  }

  await persistMatches(supabase, allMatches);
  return allMatches.length;
}

async function fetchForSource(src: GossipSource): Promise<GossipPostInput[]> {
  switch (src.platform) {
    case "rss":
      return fetchGossipRss(src);
    case "twitter":
      return fetchGossipTwitter(src);
    case "youtube":
      return fetchGossipYoutube(src);
    case "reddit":
      return fetchGossipReddit(src);
  }
}

async function upsertPosts(
  supabase: SupabaseClient,
  userId: string,
  posts: GossipPostInput[]
): Promise<{ addedIds: string[] }> {
  if (posts.length === 0) return { addedIds: [] };

  const rows = posts.map((p) => ({ ...p, user_id: userId }));

  const { data, error } = await supabase
    .from("gossip_posts")
    .upsert(rows, { onConflict: "user_id,platform,external_id", ignoreDuplicates: true })
    .select("id");

  if (error) throw error;

  return { addedIds: (data ?? []).map((r) => r.id as string) };
}
