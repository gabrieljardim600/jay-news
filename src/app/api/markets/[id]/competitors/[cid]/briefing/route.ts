import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateCompetitorBriefing } from "@/lib/markets/briefing";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string; cid: string }> };

async function assertOwner(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, marketId: string, competitorId: string) {
  const { data: market } = await supabase.from("markets").select("id").eq("id", marketId).eq("user_id", userId).single();
  if (!market) return false;
  const { data: comp } = await supabase.from("market_competitors").select("id").eq("id", competitorId).eq("market_id", marketId).single();
  return !!comp;
}

export async function GET(_req: Request, { params }: Params) {
  const { id, cid } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await assertOwner(supabase, user.id, id, cid)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("competitor_briefings")
    .select("*")
    .eq("competitor_id", cid)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(_req: Request, { params }: Params) {
  const { id, cid } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await assertOwner(supabase, user.id, id, cid)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const result = await generateCompetitorBriefing(id, cid);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
