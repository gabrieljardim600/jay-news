import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateBriefingForUser } from "@/lib/social-brand/briefing";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("social_brand_briefings")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await generateBriefingForUser(supabase, user.id);
  if (!result) return NextResponse.json({ error: "Sem posts novos para gerar briefing" }, { status: 200 });
  return NextResponse.json(result);
}
