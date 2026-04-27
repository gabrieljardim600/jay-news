import {
  ServiceAuthError,
  accountClient,
  byAccount,
  requireRole,
  withService,
} from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

const SELECT_COLS = `id, kind, label, keywords, metadata, is_active, created_at`;

export const GET = withService(async (req, ctx) => {
  const supabase = accountClient(ctx);
  const url = new URL(req.url);
  const includeInactive = url.searchParams.get("include_inactive") === "1";

  let q = supabase.from("watchlist_items").select(SELECT_COLS).order("created_at", { ascending: false });
  q = byAccount(q, ctx);
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: data || [] });
});

export const POST = withService(async (req, ctx) => {
  requireRole(ctx, "editor");
  if (!ctx.user_id) throw new ServiceAuthError(400, "X-User-Id required");

  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind || "").trim();
  const label = String(body.label || "").trim();
  if (!kind || !label) {
    return NextResponse.json(
      { error: { message: "kind and label are required" } },
      { status: 400 }
    );
  }

  const supabase = accountClient(ctx);
  const { data, error } = await supabase
    .from("watchlist_items")
    .insert({
      user_id: ctx.user_id,
      account_id: ctx.account_id,
      kind,
      label,
      keywords: Array.isArray(body.keywords) ? body.keywords : [],
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    })
    .select(SELECT_COLS)
    .single();
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ data });
});
