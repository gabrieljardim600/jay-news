import type { SupabaseClient } from "@supabase/supabase-js";
import type { WatchlistItem, ChatContextType } from "@/types";
import type { BuiltContext } from "./prompts";

interface BuildContextArgs {
  supabase: SupabaseClient;
  userId: string;
  scope: {
    type: ChatContextType;
    id?: string | null;
    article?: BuiltContext["scopeArticle"];
  };
}

/**
 * Composes the context block for a Jay chat turn.
 * Pulls watchlist + recent interactions + scope-specific data.
 */
export async function buildContext({ supabase, userId, scope }: BuildContextArgs): Promise<BuiltContext> {
  const [watchlistRes, interactionsRes] = await Promise.all([
    supabase
      .from("watchlist_items")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("user_interactions")
      .select("action, target_type, payload, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const watchlist: WatchlistItem[] = watchlistRes.data || [];
  const interactions = interactionsRes.data || [];

  const recentInteractionsSummary = summarizeInteractions(interactions);

  const ctx: BuiltContext = {
    watchlist,
    recentInteractionsSummary,
    scopeType: scope.type,
  };

  if (scope.type === "article") {
    if (scope.article) {
      ctx.scopeArticle = scope.article;
    } else if (scope.id) {
      const { data: article } = await supabase
        .from("articles")
        .select("id, title, summary, full_content, source_name, source_url, published_at")
        .eq("id", scope.id)
        .single();
      if (article) ctx.scopeArticle = article;
    }

    // Best-effort: pull a few historically related articles by overlapping keywords from the title
    if (ctx.scopeArticle) {
      ctx.historicalHits = await findHistoricalHits(supabase, userId, ctx.scopeArticle.title);
    }
  }

  if (scope.type === "digest" && scope.id) {
    const { data: digest } = await supabase
      .from("digests")
      .select("summary")
      .eq("id", scope.id)
      .eq("user_id", userId)
      .single();
    if (digest) ctx.scopeDigestSummary = digest.summary;
  }

  return ctx;
}

function summarizeInteractions(
  rows: { action: string; target_type: string | null; payload: Record<string, unknown> }[]
): string | null {
  if (!rows || rows.length === 0) return null;

  const counts: Record<string, number> = {};
  const queries: string[] = [];
  for (const r of rows) {
    const key = `${r.action}/${r.target_type || "?"}`;
    counts[key] = (counts[key] || 0) + 1;
    const q = r.payload?.query;
    if (typeof q === "string" && q.length > 0 && queries.length < 5) queries.push(q);
  }

  const summary = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => `${k}×${v}`)
    .join(", ");

  const queriesPart = queries.length > 0 ? `\nPerguntas recentes: ${queries.map((q) => `"${q.slice(0, 80)}"`).join(" | ")}` : "";
  return `Últimas ações: ${summary}.${queriesPart}`;
}

async function findHistoricalHits(supabase: SupabaseClient, userId: string, title: string) {
  // Extract significant words (4+ chars, no stopwords) from the title
  const stop = new Set([
    "para", "como", "sobre", "mais", "menos", "ainda", "entre", "esse", "essa", "isso", "este", "esta", "isto",
    "with", "from", "after", "before", "about", "their", "there", "where", "which", "would", "could", "should",
  ]);
  const tokens = Array.from(
    new Set(
      title
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 4 && !stop.has(t))
    )
  ).slice(0, 5);

  if (tokens.length === 0) return [];

  // Build OR ilike filter on title
  const orFilter = tokens.map((t) => `title.ilike.%${t}%`).join(",");

  const { data } = await supabase
    .from("articles")
    .select("title, source_name, summary, published_at, digests!inner(user_id)")
    .or(orFilter)
    .eq("digests.user_id", userId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(8);

  return (data || []).map((a) => ({
    title: a.title,
    source_name: a.source_name,
    published_at: a.published_at,
    summary: a.summary,
  }));
}
