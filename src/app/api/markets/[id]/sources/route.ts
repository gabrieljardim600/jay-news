import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

async function assertOwner(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, marketId: string) {
  const { data } = await supabase.from("markets").select("id").eq("id", marketId).eq("user_id", userId).single();
  return !!data;
}

type SourceInput = { name: string; url: string; source_type?: "rss" | "web"; weight?: number; ai_suggested?: boolean };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await assertOwner(supabase, user.id, id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase.from("market_sources").select("*").eq("market_id", id).order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await assertOwner(supabase, user.id, id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const items: SourceInput[] = Array.isArray(body.sources) ? body.sources : body.url ? [body as SourceInput] : [];
  const rows = items
    .filter((s) => s.name?.trim() && s.url?.trim())
    .map((s) => ({
      market_id: id,
      name: s.name.trim(),
      url: s.url.trim(),
      source_type: s.source_type === "web" ? "web" : "rss",
      weight: Math.min(5, Math.max(1, s.weight ?? 3)),
      ai_suggested: !!s.ai_suggested,
    }));
  if (rows.length === 0) return NextResponse.json({ error: "No sources" }, { status: 400 });

  const { data, error } = await supabase.from("market_sources").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await assertOwner(supabase, user.id, id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get("sourceId");
  if (!sourceId) return NextResponse.json({ error: "Missing sourceId" }, { status: 400 });

  const { error } = await supabase.from("market_sources").delete().eq("id", sourceId).eq("market_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
