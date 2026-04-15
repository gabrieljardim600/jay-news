import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("markets")
    .select("*, market_subtopics(id,label), market_competitors(id,name,website,enabled), market_sources(id,name,url,enabled)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("markets")
    .insert({
      user_id: user.id,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      icon: body.icon || "📊",
      color: body.color || "#fb830e",
      language: body.language || "pt-BR",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
