import { accountClient, byAccount, requireRole, withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

type Params = { id: string; cid: string };

const SELECT_COLS = `id, name, website, aliases, logo_url, cnpj, ai_suggested, enabled, created_at, updated_at`;
const UPDATABLE = new Set(["name", "website", "aliases", "logo_url", "cnpj", "enabled"]);

export const PATCH = withService<unknown, Params>(async (req, ctx, { params }) => {
  requireRole(ctx, "editor");
  const { id: marketId, cid } = await params;
  const body = await req.json().catch(() => ({}));

  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (UPDATABLE.has(k)) updates[k] = v;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: { message: "No updatable fields" } }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const supabase = accountClient(ctx);
  let q = supabase
    .from("market_competitors")
    .update(updates)
    .eq("id", cid)
    .eq("market_id", marketId);
  q = byAccount(q, ctx);
  const { data, error } = await q.select(SELECT_COLS).maybeSingle();

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  if (!data) return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  return NextResponse.json({ data });
});

export const DELETE = withService<unknown, Params>(async (_req, ctx, { params }) => {
  requireRole(ctx, "editor");
  const { id: marketId, cid } = await params;
  const supabase = accountClient(ctx);

  let q = supabase
    .from("market_competitors")
    .delete()
    .eq("id", cid)
    .eq("market_id", marketId);
  q = byAccount(q, ctx);
  const { error } = await q;

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ ok: true });
});
