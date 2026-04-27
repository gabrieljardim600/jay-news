import { accountClient, byAccount, requireRole, withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

type Params = { id: string };

const SELECT_COLS = `id, name, description, icon, color, language, research_modules, is_active, created_at, updated_at`;
const UPDATABLE = new Set([
  "name",
  "description",
  "icon",
  "color",
  "language",
  "research_modules",
  "is_active",
]);

export const GET = withService<unknown, Params>(async (_req, ctx, { params }) => {
  const { id } = await params;
  const supabase = accountClient(ctx);

  let q = supabase.from("markets").select(SELECT_COLS).eq("id", id);
  q = byAccount(q, ctx);
  const { data: market, error } = await q.maybeSingle();

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  if (!market) return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });

  let cq = supabase
    .from("market_competitors")
    .select("id, name, website, aliases, logo_url, cnpj, ai_suggested, enabled, created_at")
    .eq("market_id", id);
  cq = byAccount(cq, ctx);
  const { data: competitors } = await cq.order("created_at", { ascending: true });

  let sq = supabase
    .from("market_sources")
    .select("id, name, url, source_type, weight, ai_suggested, is_active, created_at")
    .eq("market_id", id);
  sq = byAccount(sq, ctx);
  const { data: sources } = await sq.order("created_at", { ascending: true });

  return NextResponse.json({
    data: { ...market, competitors: competitors || [], sources: sources || [] },
  });
});

export const PATCH = withService<unknown, Params>(async (req, ctx, { params }) => {
  requireRole(ctx, "editor");
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (UPDATABLE.has(k)) updates[k] = v;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: { message: "No updatable fields provided" } }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const supabase = accountClient(ctx);
  let q = supabase.from("markets").update(updates).eq("id", id);
  q = byAccount(q, ctx);
  const { data, error } = await q.select(SELECT_COLS).maybeSingle();

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  if (!data) return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  return NextResponse.json({ data });
});

export const DELETE = withService<unknown, Params>(async (_req, ctx, { params }) => {
  requireRole(ctx, "editor");
  const { id } = await params;
  const supabase = accountClient(ctx);

  let q = supabase
    .from("markets")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  q = byAccount(q, ctx);
  const { error } = await q;

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ ok: true });
});
