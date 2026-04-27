import { accountClient, byAccount, requireRole, withService } from "@/lib/api/service-auth";
import { generateCompetitorBriefing } from "@/lib/markets/briefing";
import { NextResponse } from "next/server";
import { after } from "next/server";

export const maxDuration = 300;

type Params = { id: string; cid: string };

export const POST = withService<unknown, Params>(async (req, ctx, { params }) => {
  requireRole(ctx, "editor");
  const { id: marketId, cid } = await params;
  const body = await req.json().catch(() => ({}));
  const profileId = typeof body.profile_id === "string" ? body.profile_id : undefined;

  const supabase = accountClient(ctx);
  let mq = supabase.from("markets").select("id").eq("id", marketId);
  mq = byAccount(mq, ctx);
  const { data: market } = await mq.maybeSingle();
  if (!market) {
    return NextResponse.json({ error: { message: "Market not found in account" } }, { status: 404 });
  }

  let cq = supabase
    .from("market_competitors")
    .select("id")
    .eq("id", cid)
    .eq("market_id", marketId);
  cq = byAccount(cq, ctx);
  const { data: competitor } = await cq.maybeSingle();
  if (!competitor) {
    return NextResponse.json({ error: { message: "Competitor not found" } }, { status: 404 });
  }

  // Cria row imediatamente pra retornar id; pipeline reutiliza via existingBriefingId
  const { data: row, error: insertErr } = await supabase
    .from("competitor_briefings")
    .insert({
      market_id: marketId,
      competitor_id: cid,
      account_id: ctx.account_id,
      status: "queued",
    })
    .select("id")
    .single();
  if (insertErr || !row) {
    return NextResponse.json(
      { error: { message: insertErr?.message || "Failed to create briefing row" } },
      { status: 500 }
    );
  }
  const briefingId = row.id;

  after(async () => {
    try {
      await generateCompetitorBriefing(marketId, cid, {
        profileId,
        accountId: ctx.account_id,
        existingBriefingId: briefingId,
      });
    } catch (err) {
      console.error(`[v1/briefing] failed for ${cid}:`, err);
      await supabase
        .from("competitor_briefings")
        .update({ status: "failed", error: String(err) })
        .eq("id", briefingId);
    }
  });

  return NextResponse.json({
    data: { job_id: briefingId, status: "queued" },
  });
});

export const GET = withService<unknown, Params>(async (_req, ctx, { params }) => {
  const { id: marketId, cid } = await params;
  const supabase = accountClient(ctx);

  let q = supabase
    .from("competitor_briefings")
    .select("id, status, resumo, data_quality, model_used, articles_analyzed, error, started_at, finished_at, profile_slug, profile_label")
    .eq("market_id", marketId)
    .eq("competitor_id", cid)
    .neq("status", "superseded")
    .order("started_at", { ascending: false })
    .limit(20);
  q = byAccount(q, ctx);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: data || [] });
});
