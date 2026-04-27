import { accountClient, byAccount, requireRole, withService } from "@/lib/api/service-auth";
import { NextResponse } from "next/server";

type Params = { id: string };

const SELECT_COLS = `id, name, website, aliases, logo_url, cnpj, ai_suggested, enabled, created_at, updated_at`;

export const GET = withService<unknown, Params>(async (_req, ctx, { params }) => {
  const { id: marketId } = await params;
  const supabase = accountClient(ctx);

  let q = supabase
    .from("market_competitors")
    .select(SELECT_COLS)
    .eq("market_id", marketId)
    .order("created_at", { ascending: true });
  q = byAccount(q, ctx);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: data || [] });
});

export const POST = withService<unknown, Params>(async (req, ctx, { params }) => {
  requireRole(ctx, "editor");
  const { id: marketId } = await params;
  const body = await req.json().catch(() => ({}));

  // Confirma que o market pertence à account
  const supabase = accountClient(ctx);
  let mq = supabase.from("markets").select("id").eq("id", marketId);
  mq = byAccount(mq, ctx);
  const { data: market } = await mq.maybeSingle();
  if (!market) return NextResponse.json({ error: { message: "Market not found in account" } }, { status: 404 });

  const list = Array.isArray(body.competitors)
    ? body.competitors
    : body.name
      ? [body]
      : null;
  if (!list || list.length === 0) {
    return NextResponse.json({ error: { message: "Provide name or competitors[]" } }, { status: 400 });
  }

  const rows = list
    .map((c: Record<string, unknown>) => {
      const name = String(c.name || "").trim();
      if (!name) return null;
      return {
        market_id: marketId,
        account_id: ctx.account_id,
        name,
        website: c.website || null,
        aliases: Array.isArray(c.aliases) ? c.aliases : [],
        cnpj: c.cnpj || null,
        ai_suggested: c.ai_suggested === true,
      };
    })
    .filter(Boolean);

  const { data, error } = await supabase.from("market_competitors").insert(rows).select(SELECT_COLS);
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 });
  return NextResponse.json({ data: data || [] });
});
