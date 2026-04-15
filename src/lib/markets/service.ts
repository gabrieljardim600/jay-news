import { createClient } from "@supabase/supabase-js";
import { collectForMarket, type CollectedArticle } from "./collector";

type RunResult = {
  runId: string;
  articlesFound: number;
  articlesNew: number;
};

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type ServiceClient = ReturnType<typeof createServiceClient>;

async function loadMarketContext(service: ServiceClient, marketId: string) {
  const [{ data: market }, { data: subtopics }, { data: competitors }, { data: sources }] = await Promise.all([
    service.from("markets").select("id, name, description, language").eq("id", marketId).single(),
    service.from("market_subtopics").select("id, label").eq("market_id", marketId),
    service.from("market_competitors").select("id, name, website, aliases, enabled").eq("market_id", marketId),
    service.from("market_sources").select("id, name, url, source_type, enabled").eq("market_id", marketId),
  ]);
  return {
    market,
    subtopics: subtopics || [],
    competitors: competitors || [],
    sources: sources || [],
  };
}

export async function runMarketCollection(marketId: string): Promise<RunResult> {
  const service = createServiceClient();

  const { data: runRow, error: runErr } = await service
    .from("market_collection_runs")
    .insert({ market_id: marketId, status: "running" })
    .select()
    .single();
  if (runErr || !runRow) throw new Error(runErr?.message || "Failed to create run");
  const runId = runRow.id;

  try {
    const ctx = await loadMarketContext(service, marketId);
    if (!ctx.market) throw new Error("Market not found");

    const collected: CollectedArticle[] = await collectForMarket({
      market: ctx.market,
      subtopics: ctx.subtopics,
      competitors: ctx.competitors,
      sources: ctx.sources,
    });

    let articlesNew = 0;

    if (collected.length > 0) {
      // Upsert on (market_id, source_url) — update mentions/score on conflict
      const rows = collected.map((a) => ({
        market_id: marketId,
        title: a.title,
        source_name: a.source_name,
        source_url: a.source_url,
        summary: a.summary,
        full_content: a.full_content,
        image_url: a.image_url,
        published_at: a.published_at,
        relevance_score: a.relevance_score,
        mentioned_competitor_ids: a.mentioned_competitor_ids,
        found_via: a.found_via,
      }));

      // Count new vs existing before upsert
      const urls = rows.map((r) => r.source_url);
      const { data: existing } = await service
        .from("market_articles")
        .select("source_url")
        .eq("market_id", marketId)
        .in("source_url", urls);
      const existingSet = new Set((existing || []).map((e: { source_url: string }) => e.source_url));
      articlesNew = rows.filter((r) => !existingSet.has(r.source_url)).length;

      const { error: upsertErr } = await service
        .from("market_articles")
        .upsert(rows, { onConflict: "market_id,source_url" });
      if (upsertErr) throw upsertErr;
    }

    await service
      .from("market_collection_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        articles_found: collected.length,
        articles_new: articlesNew,
      })
      .eq("id", runId);

    return { runId, articlesFound: collected.length, articlesNew };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await service
      .from("market_collection_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error: msg })
      .eq("id", runId);
    throw e;
  }
}
