import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GossipDossier, GossipTopic } from "@/lib/gossip/types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const date = dateParam ?? new Date().toISOString().slice(0, 10);

  const { data: topicRows, error: topicsErr } = await supabase
    .from("gossip_topics")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("priority", { ascending: false })
    .order("name", { ascending: true });
  if (topicsErr) return NextResponse.json({ error: topicsErr.message }, { status: 500 });

  const topics = (topicRows ?? []) as GossipTopic[];
  if (topics.length === 0) {
    return NextResponse.json([], {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" },
    });
  }

  const topicIds = topics.map((t) => t.id);
  const { data: dossierRows, error: dossErr } = await supabase
    .from("gossip_dossiers")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .in("topic_id", topicIds);
  if (dossErr) return NextResponse.json({ error: dossErr.message }, { status: 500 });

  const byTopic = new Map<string, GossipDossier>();
  for (const d of (dossierRows ?? []) as GossipDossier[]) {
    byTopic.set(d.topic_id, d);
  }

  const out = topics.map((t) => ({
    topic: t,
    dossier: byTopic.get(t.id) ?? null,
  }));

  return NextResponse.json(out, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" },
  });
}
