import {
  ServiceAuthError,
  accountClient,
  byAccount,
  requireRole,
  withService,
} from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

const SELECT_COLS = `id, type, name, aliases, image_url, priority, active, metadata, created_at, updated_at`;

export const GET = withService(async (req, ctx) => {
  const supabase = accountClient(ctx);
  const url = new URL(req.url);
  const includeInactive = url.searchParams.get("include_inactive") === "1";

  let q = supabase.from("gossip_topics").select(SELECT_COLS).order("priority", { ascending: false });
  q = byAccount(q, ctx);
  if (!includeInactive) q = q.eq("active", true);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: data || [] });
});

export const POST = withService(async (req, ctx) => {
  requireRole(ctx, "editor");
  if (!ctx.user_id) throw new ServiceAuthError(400, "X-User-Id required for writes");

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const type = String(body.type || "").trim();
  if (!name || !type) {
    return NextResponse.json(
      { error: { message: "name and type are required" } },
      { status: 400 }
    );
  }

  const insert = {
    user_id: ctx.user_id,
    account_id: ctx.account_id,
    name,
    type,
    aliases: Array.isArray(body.aliases) ? body.aliases : [],
    priority: typeof body.priority === "number" ? body.priority : 1,
    image_url: body.image_url || null,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
  };

  const supabase = accountClient(ctx);
  const { data, error } = await supabase
    .from("gossip_topics")
    .insert(insert)
    .select(SELECT_COLS)
    .single();
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ data });
});
