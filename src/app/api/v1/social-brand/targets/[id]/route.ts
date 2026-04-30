import {
  accountClient,
  byAccount,
  requireRole,
  withService,
} from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

type Params = { id: string };

const SELECT_COLS = `id, platform, identifier, label, brand_key, niche, mode, is_active,
  last_synced_at, last_sync_status, last_sync_error, profile, created_at, updated_at`;

export const PATCH = withService<unknown, Params>(async (req, ctx, { params }) => {
  requireRole(ctx, "editor");
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const allowed: Record<string, unknown> = {};
  for (const k of ["label", "brand_key", "niche", "mode", "is_active"] as const) {
    if (k in body) allowed[k] = body[k];
  }
  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: { message: "no patchable fields" } }, { status: 400 });
  }

  const supabase = accountClient(ctx);
  let q = supabase.from("social_brand_targets").update(allowed).eq("id", id);
  q = byAccount(q, ctx);
  const { data, error } = await q.select(SELECT_COLS).single();
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ data });
});

export const DELETE = withService<unknown, Params>(async (_req, ctx, { params }) => {
  requireRole(ctx, "editor");
  const { id } = await params;
  const supabase = accountClient(ctx);
  let q = supabase.from("social_brand_targets").update({ is_active: false }).eq("id", id);
  q = byAccount(q, ctx);
  const { error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ ok: true });
});
