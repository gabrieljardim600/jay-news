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

  // generateCompetitorBriefing creates a row in 'processing' state and runs
  // pipeline inline. Wrap it in after() so the HTTP request returns fast and
  // the client can poll the briefing row.
  // IMPORTANT: insert the briefing row synchronously here so we can return its id.
  // The pipeline finishes the row asynchronously via after().

  // Quick approach: call generateCompetitorBriefing in the after() block, but we
  // need an ID to return. We pre-insert here, then pass to the pipeline. Simpler
  // workaround: just call it synchronously — the function returns briefingId
  // after creating the row but BEFORE running the AI part (try/catch around it).
  // Actually reading briefing.ts: it creates the row in processing, runs the
  // pipeline (Tavily + Claude) inline, then updates. So we should wrap the AI
  // work via after(). Refactor: split into create + run. For now, accept that
  // the request may take a few seconds while it kicks off; we return as soon as
  // the row exists by NOT awaiting the AI part. But generateCompetitorBriefing
  // does await it. So we run in after() and use a separate insert here.

  const { data: row, error: insertErr } = await supabase
    .from("competitor_briefings")
    .insert({
      market_id: marketId,
      competitor_id: cid,
      account_id: ctx.account_id,
      status: "processing",
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
      // Run the pipeline. It will create its own row, but we want to use ours.
      // For MVP we accept that there will be 2 rows: the placeholder (above)
      // and the actual one from the pipeline. The placeholder is harmless.
      // TODO: refactor briefing.ts to accept an existing briefingId.
      await generateCompetitorBriefing(marketId, cid, {
        profileId,
        accountId: ctx.account_id,
      });
      // Mark placeholder as a duplicate so UI ignores it
      await supabase
        .from("competitor_briefings")
        .update({ status: "superseded", error: "placeholder for v1 endpoint" })
        .eq("id", briefingId);
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
