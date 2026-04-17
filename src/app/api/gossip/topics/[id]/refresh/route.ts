import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDossierForTopic } from "@/lib/gossip/dossier";
import type { GossipTopic } from "@/lib/gossip/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const { data: topic, error: topicErr } = await supabase
    .from("gossip_topics")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (topicErr) return NextResponse.json({ error: topicErr.message }, { status: 500 });
  if (!topic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const dossier = await generateDossierForTopic(
      supabase,
      user.id,
      topic as GossipTopic,
      new Date()
    );
    if (!dossier) {
      return NextResponse.json({ dossier: null, message: "Sem posts novos" });
    }
    return NextResponse.json({ dossier });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
