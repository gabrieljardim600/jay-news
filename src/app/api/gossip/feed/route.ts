import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  GossipPost,
  GossipSourceTier,
  GossipPlatform,
  MatchedBy,
} from "@/lib/gossip/types";

interface SourceJoin {
  label: string;
  tier: GossipSourceTier;
  platform: GossipPlatform;
}

interface TopicJoin {
  name: string;
}

interface PostTopicJoin {
  topic_id: string;
  matched_by: MatchedBy;
  gossip_topics: TopicJoin | TopicJoin[] | null;
}

interface FeedRow extends GossipPost {
  gossip_sources: SourceJoin | SourceJoin[] | null;
  gossip_post_topics: PostTopicJoin[] | null;
}

function firstOrSelf<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const topicId = searchParams.get("topic_id") || undefined;
  const sourceId = searchParams.get("source_id") || undefined;
  const sinceParam = searchParams.get("since");
  const since = sinceParam ?? new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  // If we have topic filter, restrict post_ids first via gossip_post_topics
  let postIdsFilter: string[] | null = null;
  if (topicId) {
    const { data: joinRows, error: joinErr } = await supabase
      .from("gossip_post_topics")
      .select("post_id")
      .eq("topic_id", topicId);
    if (joinErr) return NextResponse.json({ error: joinErr.message }, { status: 500 });
    postIdsFilter = (joinRows ?? []).map((r) => r.post_id as string);
    if (postIdsFilter.length === 0) {
      return NextResponse.json(
        { data: [] },
        { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } }
      );
    }
  }

  let query = supabase
    .from("gossip_posts")
    .select(
      `*,
       gossip_sources ( label, tier, platform ),
       gossip_post_topics ( topic_id, matched_by, gossip_topics ( name ) )`
    )
    .eq("user_id", user.id)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(100);

  if (sourceId) query = query.eq("source_id", sourceId);
  if (postIdsFilter) query = query.in("id", postIdsFilter);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as FeedRow[];
  const out = rows.map((row) => {
    const source = firstOrSelf(row.gossip_sources);
    const topics = (row.gossip_post_topics ?? []).map((pt) => {
      const t = firstOrSelf(pt.gossip_topics);
      return {
        topic_id: pt.topic_id,
        name: t?.name ?? "",
        matched_by: pt.matched_by,
      };
    });
    const {
      gossip_sources: _s,
      gossip_post_topics: _pt,
      ...post
    } = row;
    void _s;
    void _pt;
    return {
      post: post as GossipPost,
      source: source ?? { label: "", tier: "primary" as GossipSourceTier, platform: "rss" as GossipPlatform },
      matched_topics: topics,
    };
  });

  return NextResponse.json(
    { data: out },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } }
  );
}
