import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: market } = await supabase.from("markets").select("id").eq("id", id).eq("user_id", user.id).single();
  if (!market) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const competitorId = searchParams.get("competitorId");
  const limit = Math.min(100, Math.max(5, Number(searchParams.get("limit") || 50)));

  let query = supabase
    .from("market_articles")
    .select("*")
    .eq("market_id", id)
    .order("relevance_score", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (competitorId) {
    query = query.contains("mentioned_competitor_ids", [competitorId]);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
