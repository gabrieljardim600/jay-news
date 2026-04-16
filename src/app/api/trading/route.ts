import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTradingBrief } from "@/lib/trading/generator";

export const maxDuration = 300;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || undefined;
  const limit = Math.min(60, Math.max(1, Number(searchParams.get("limit") || 14)));

  let query = supabase
    .from("trading_briefs")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("edition", { ascending: true })
    .limit(limit);

  if (date) query = query.eq("date", date);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const edition = body.edition === "closing" ? "closing" : "morning";
  const date = typeof body.date === "string" ? body.date : undefined;

  try {
    const result = await generateTradingBrief(user.id, edition, date);
    // Fetch the completed row
    const { data } = await supabase
      .from("trading_briefs")
      .select("*")
      .eq("id", result.briefId)
      .single();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
