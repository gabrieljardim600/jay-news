import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

async function assertOwner(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, marketId: string) {
  const { data } = await supabase.from("markets").select("id").eq("id", marketId).eq("user_id", userId).single();
  return !!data;
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await assertOwner(supabase, user.id, id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase.from("market_subtopics").select("*").eq("market_id", id).order("created_at");
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
  const labels: string[] = Array.isArray(body.labels)
    ? body.labels.map((l: unknown) => String(l).trim()).filter(Boolean)
    : body.label ? [String(body.label).trim()] : [];
  if (labels.length === 0) return NextResponse.json({ error: "No labels" }, { status: 400 });

  const rows = labels.map((label) => ({ market_id: id, label }));
  const { data, error } = await supabase.from("market_subtopics").insert(rows).select();
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
  const subtopicId = searchParams.get("subtopicId");
  if (!subtopicId) return NextResponse.json({ error: "Missing subtopicId" }, { status: 400 });

  const { error } = await supabase.from("market_subtopics").delete().eq("id", subtopicId).eq("market_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
