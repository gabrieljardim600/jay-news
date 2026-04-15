import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

async function assertOwner(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, marketId: string) {
  const { data } = await supabase.from("markets").select("id").eq("id", marketId).eq("user_id", userId).single();
  return !!data;
}

type CompetitorInput = { name: string; website?: string | null; aliases?: string[]; ai_suggested?: boolean; cnpj?: string | null };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await assertOwner(supabase, user.id, id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase.from("market_competitors").select("*").eq("market_id", id).order("created_at");
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
  const items: CompetitorInput[] = Array.isArray(body.competitors)
    ? body.competitors
    : body.name ? [body as CompetitorInput] : [];
  const rows = items
    .filter((c) => c.name?.trim())
    .map((c) => ({
      market_id: id,
      name: c.name.trim(),
      website: c.website?.trim() || null,
      aliases: Array.isArray(c.aliases) ? c.aliases.map((a) => String(a).trim()).filter(Boolean) : [],
      ai_suggested: !!c.ai_suggested,
      cnpj: c.cnpj ? String(c.cnpj).replace(/\D+/g, "") : null,
    }));
  if (rows.length === 0) return NextResponse.json({ error: "No competitors" }, { status: 400 });

  const { data, error } = await supabase.from("market_competitors").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await assertOwner(supabase, user.id, id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { competitorId, ...updates } = body;
  if (!competitorId) return NextResponse.json({ error: "Missing competitorId" }, { status: 400 });

  const allowed: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["name", "website", "aliases", "logo_url", "enabled", "cnpj"]) {
    if (k in updates) allowed[k] = updates[k];
  }

  const { data, error } = await supabase.from("market_competitors")
    .update(allowed).eq("id", competitorId).eq("market_id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await assertOwner(supabase, user.id, id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const competitorId = searchParams.get("competitorId");
  if (!competitorId) return NextResponse.json({ error: "Missing competitorId" }, { status: 400 });

  const { error } = await supabase.from("market_competitors").delete().eq("id", competitorId).eq("market_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
