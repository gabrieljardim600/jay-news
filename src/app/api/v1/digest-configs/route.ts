import {
  ServiceAuthError,
  accountClient,
  byAccount,
  byProfile,
  readProfileId,
  requireRole,
  withService,
} from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

const SELECT_COLS = `id, name, icon, color, language, summary_style, digest_time, max_articles,
  is_active, digest_type, trend_topic, trend_keywords, auto_generate, created_at, updated_at`;

export const GET = withService(async (req, ctx) => {
  const supabase = accountClient(ctx);
  const url = new URL(req.url);
  const includeInactive = url.searchParams.get("include_inactive") === "1";

  let q = supabase.from("digest_configs").select(SELECT_COLS).order("created_at", { ascending: false });
  q = byProfile(byAccount(q, ctx), req);
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: data || [] });
});

export const POST = withService(async (req, ctx) => {
  requireRole(ctx, "editor");
  if (!ctx.user_id) {
    throw new ServiceAuthError(400, "X-User-Id required for writes");
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: { message: "name is required" } }, { status: 400 });
  }

  const supabase = accountClient(ctx);
  const profileId = readProfileId(req);
  const insert = {
    user_id: ctx.user_id,
    account_id: ctx.account_id,
    profile_id: profileId,
    name,
    icon: body.icon ?? undefined,
    color: body.color ?? undefined,
    language: body.language ?? undefined,
    summary_style: body.summary_style ?? undefined,
    digest_time: body.digest_time ?? undefined,
    max_articles: typeof body.max_articles === "number" ? body.max_articles : undefined,
    digest_type: body.digest_type ?? undefined,
    trend_topic: body.trend_topic ?? null,
    trend_keywords: Array.isArray(body.trend_keywords) ? body.trend_keywords : null,
    auto_generate: typeof body.auto_generate === "boolean" ? body.auto_generate : undefined,
  };
  const cleaned = Object.fromEntries(Object.entries(insert).filter(([, v]) => v !== undefined));

  const { data, error } = await supabase
    .from("digest_configs")
    .insert(cleaned)
    .select(SELECT_COLS)
    .single();

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ data });
});
