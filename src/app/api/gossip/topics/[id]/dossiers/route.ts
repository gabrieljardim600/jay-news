import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 90) : 30;

  // Confirma que o topic é do user (via RLS + filtro)
  const { data: topic, error: topicErr } = await supabase
    .from("gossip_topics")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (topicErr) return NextResponse.json({ error: topicErr.message }, { status: 500 });
  if (!topic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("gossip_dossiers")
    .select("*")
    .eq("user_id", user.id)
    .eq("topic_id", id)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
