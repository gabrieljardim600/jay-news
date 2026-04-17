import type { SupabaseClient } from "@supabase/supabase-js";
import type { GossipPost, GossipTopic } from "./types";

export interface MatchResult {
  post_id: string;
  topic_id: string;
  confidence: number;
  matched_by: "alias" | "claude";
}

export function matchByAliases(
  post: Pick<GossipPost, "id" | "title" | "body">,
  topics: GossipTopic[]
): MatchResult[] {
  const haystack = `${post.title ?? ""} ${post.body ?? ""}`.toLowerCase();
  const matches: MatchResult[] = [];
  for (const t of topics) {
    if (!t.active) continue;
    for (const alias of t.aliases) {
      if (alias.length < 3) continue;
      const re = new RegExp(`\\b${escapeRegex(alias.toLowerCase())}\\b`, "i");
      if (re.test(haystack)) {
        matches.push({ post_id: post.id, topic_id: t.id, confidence: 1.0, matched_by: "alias" });
        break;
      }
    }
  }
  return matches;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function persistMatches(
  supabase: SupabaseClient,
  matches: MatchResult[]
): Promise<void> {
  if (matches.length === 0) return;
  const { error } = await supabase.from("gossip_post_topics").upsert(
    matches.map((m) => ({
      post_id: m.post_id,
      topic_id: m.topic_id,
      confidence: m.confidence,
      matched_by: m.matched_by,
    })),
    { onConflict: "post_id,topic_id", ignoreDuplicates: false }
  );
  if (error) throw error;
}
