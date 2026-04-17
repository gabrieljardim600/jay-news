import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpikeLevel } from "./types";

export async function calcSpikeForTopic(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
  referenceDate: Date = new Date()
): Promise<{ score: number; level: SpikeLevel; count24h: number; avg7d: number }> {
  const end = referenceDate.toISOString();
  const start24 = new Date(referenceDate.getTime() - 24 * 3600_000).toISOString();
  const start7d = new Date(referenceDate.getTime() - 7 * 24 * 3600_000).toISOString();

  // Faz 2 queries: (a) IDs de posts do user nos ranges, (b) conta post_topics filtrando por topic_id e post_id in (...)
  // Abordagem simples: busca post_ids do user nos ranges via queries separadas.
  const { data: posts24 } = await supabase
    .from("gossip_posts")
    .select("id")
    .eq("user_id", userId)
    .gte("published_at", start24)
    .lt("published_at", end);
  const ids24 = (posts24 ?? []).map((p) => p.id);

  const { data: posts7d } = await supabase
    .from("gossip_posts")
    .select("id")
    .eq("user_id", userId)
    .gte("published_at", start7d);
  const ids7d = (posts7d ?? []).map((p) => p.id);

  const [count24Result, count7dResult] = await Promise.all([
    ids24.length === 0
      ? Promise.resolve({ count: 0 })
      : supabase
          .from("gossip_post_topics")
          .select("post_id", { count: "exact", head: true })
          .eq("topic_id", topicId)
          .in("post_id", ids24)
          .neq("matched_by", "manual_negative"),
    ids7d.length === 0
      ? Promise.resolve({ count: 0 })
      : supabase
          .from("gossip_post_topics")
          .select("post_id", { count: "exact", head: true })
          .eq("topic_id", topicId)
          .in("post_id", ids7d)
          .neq("matched_by", "manual_negative"),
  ]);

  const count24h = count24Result.count ?? 0;
  const count7d = count7dResult.count ?? 0;
  const avg7d = Math.max(count7d / 7, 0.5);
  const score = count24h / avg7d;
  const level: SpikeLevel = score >= 3 ? "high" : score >= 1.5 ? "medium" : "low";
  return { score, level, count24h, avg7d };
}
