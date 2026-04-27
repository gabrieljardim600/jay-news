import {
  ServiceAuthError,
  accountClient,
  byAccount,
  requireRole,
  withService,
} from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

const SELECT_COLS = `id, platform, handle, label, category, is_active, created_at`;

export const GET = withService(async (_req, ctx) => {
  const supabase = accountClient(ctx);
  let q = supabase.from("social_voices").select(SELECT_COLS).order("created_at", { ascending: false });
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
  const handle = String(body.handle || "").trim();
  const label = String(body.label || "").trim();
  if (!platform || !handle || !label) {
    return NextResponse.json(
      { error: { message: "platform, handle, label are required" } },
      { status: 400 }
    );
  }

  const supabase = accountClient(ctx);
  const { data, error } = await supabase
    .from("social_voices")
    .insert({
      user_id: ctx.user_id,
      account_id: ctx.account_id,
      platform,
      handle,
      label,
      category: body.category || "analyst",
    })
    .select(SELECT_COLS)
    .single();
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ data });
});
