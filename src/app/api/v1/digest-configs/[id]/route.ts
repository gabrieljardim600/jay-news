import {
  accountClient,
  byAccount,
  requireRole,
  withService,
} from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

type Params = { id: string };

const SELECT_COLS = `id, name, icon, color, language, summary_style, digest_time, max_articles,
  is_active, digest_type, trend_topic, trend_keywords, auto_generate, created_at, updated_at`;

const UPDATABLE = new Set([
  "name",
  "icon",
  "color",
  "language",
  "summary_style",
  "digest_time",
  "max_articles",
  "digest_type",
  "trend_topic",
  "trend_keywords",
  "auto_generate",
  "is_active",
]);

export const GET = withService<unknown, Params>(async (_req, ctx, { params }) => {
  const { id } = await params;
  const supabase = accountClient(ctx);

  let q = supabase.from("digest_configs").select(SELECT_COLS).eq("id", id);
  q = byAccount(q, ctx);
  const { data, error } = await q.maybeSingle();

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  if (!data) return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  return NextResponse.json({ data });
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
  let q = supabase.from("digest_configs").update(updates).eq("id", id);
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

  // Soft delete via is_active=false (mantém histórico de digests gerados)
  let q = supabase
    .from("digest_configs")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  q = byAccount(q, ctx);
  const { error } = await q;

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ ok: true });
});
