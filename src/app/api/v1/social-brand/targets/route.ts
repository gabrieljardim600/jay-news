import {
  ServiceAuthError,
  accountClient,
  byAccount,
  requireRole,
  withService,
} from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

const SELECT_COLS = `id, platform, identifier, label, brand_key, niche, mode, is_active,
  last_synced_at, last_sync_status, last_sync_error, profile, created_at, updated_at`;

const VALID_PLATFORMS = ["instagram", "facebook_page", "meta_ads", "tiktok"];

export const GET = withService(async (_req, ctx) => {
  const supabase = accountClient(ctx);
  let q = supabase
    .from("social_brand_targets")
    .select(SELECT_COLS)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  q = byAccount(q, ctx);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: data || [] });
});

export const POST = withService(async (req, ctx) => {
  requireRole(ctx, "editor");
  if (!ctx.user_id) throw new ServiceAuthError(400, "X-User-Id required");

  const body = await req.json().catch(() => ({}));
  const platform = String(body.platform || "").trim();
  const identifier = String(body.identifier || "")
    .trim()
    .replace(/^@/, "");
  const label = String(body.label || "").trim();

  if (!platform || !identifier || !label) {
    return NextResponse.json(
      { error: { message: "platform, identifier, label são obrigatórios" } },
      { status: 400 },
    );
  }
  if (!VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: { message: "platform inválida" } }, { status: 400 });
  }

  const supabase = accountClient(ctx);
  const { data, error } = await supabase
    .from("social_brand_targets")
    .upsert(
      {
        account_id: ctx.account_id,
        user_id: ctx.user_id,
        platform,
        identifier,
        label,
        brand_key: body.brand_key ? String(body.brand_key).trim() : null,
        niche: body.niche ? String(body.niche).trim() : null,
        mode: body.mode === "news_only" ? "news_only" : "archive_posts",
        is_active: true,
      },
      { onConflict: "account_id,platform,identifier" },
    )
    .select(SELECT_COLS)
    .single();

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ data });
});
