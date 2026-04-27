import {
  ServiceAuthError,
  accountClient,
  byAccount,
  requireRole,
  withService,
} from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

const SELECT_COLS = `id, name, description, icon, color, language, research_modules, is_active, created_at, updated_at`;

export const GET = withService(async (req, ctx) => {
  const supabase = accountClient(ctx);
  const url = new URL(req.url);
  const includeInactive = url.searchParams.get("include_inactive") === "1";

  let q = supabase.from("markets").select(SELECT_COLS).order("created_at", { ascending: false });
  q = byAccount(q, ctx);
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: data || [] });
});

export const POST = withService(async (req, ctx) => {
  requireRole(ctx, "editor");
  if (!ctx.user_id) throw new ServiceAuthError(400, "X-User-Id required for writes");

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: { message: "name is required" } }, { status: 400 });
  }

  const insert = {
    user_id: ctx.user_id,
    account_id: ctx.account_id,
    name,
    description: body.description || null,
    icon: body.icon ?? undefined,
    color: body.color ?? undefined,
    language: body.language ?? undefined,
    research_modules: Array.isArray(body.research_modules) ? body.research_modules : undefined,
  };
  const cleaned = Object.fromEntries(Object.entries(insert).filter(([, v]) => v !== undefined));

  const supabase = accountClient(ctx);
  const { data, error } = await supabase
    .from("markets")
    .insert(cleaned)
    .select(SELECT_COLS)
    .single();

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ data });
});
