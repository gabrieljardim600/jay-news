import { createClient } from "@supabase/supabase-js";
import { filterArticles } from "@/lib/digest/filter";
import { enrichArticles } from "@/lib/sources/enrich";
import { cleanArticlesContent } from "@/lib/sources/content-cleaner";
import { processArticles, generateDaySummary, generateTrendsSearchAngles, generateTrendsBriefing } from "@/lib/digest/processor";
import { computeTrends } from "@/lib/digest/trends";
import type { RawArticle, Topic, RssSource, Alert, Exclusion, DigestMetadata } from "@/types";

type Settings = {
  language: string;
  summary_style: string;
  max_articles: number;
  digest_type?: string;
  trend_topic?: string | null;
  trend_keywords?: string[] | null;
};

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Create the digest record and load all config data.
 * Returns immediately — call runDigestPipeline() to do the heavy work.
 */
export async function initializeDigest(
  userId: string,
  type: "scheduled" | "on_demand",
  digestConfigId?: string
): Promise<{ digestId: string; settings: Settings; topics: Topic[]; sources: RssSource[]; alerts: Alert[]; exclusions: Exclusion[] }> {
  const supabase = getServiceClient();

  let settings: Settings;

  if (digestConfigId) {
    const { data: config } = await supabase
      .from("digest_configs")
      .select("language, summary_style, max_articles, digest_type, trend_topic, trend_keywords")
      .eq("id", digestConfigId)
      .single();
    if (!config) throw new Error(`Digest config not found: ${digestConfigId}`);
    settings = config;
  } else {
    const { data: settingsData } = await supabase
      .from("user_settings")
      .select("language, summary_style, max_articles")
      .eq("user_id", userId)
      .single();
    settings = settingsData || { language: "pt-BR", summary_style: "executive", max_articles: 20 };
  }

  const configFilter = digestConfigId
    ? { column: "digest_config_id" as const, value: digestConfigId }
    : { column: "user_id" as const, value: userId };

  const [topicsRes, sourcesRes, alertsRes, exclusionsRes] = await Promise.all([
    supabase.from("topics").select("*").eq(configFilter.column, configFilter.value).eq("is_active", true),
    supabase.from("rss_sources").select("*").eq(configFilter.column, configFilter.value).eq("is_active", true),
    supabase.from("alerts").select("*").eq(configFilter.column, configFilter.value).eq("is_active", true),
    supabase.from("exclusions").select("*").eq(configFilter.column, configFilter.value).eq("is_active", true),
  ]);

  const topics: Topic[] = topicsRes.data || [];
  const sources: RssSource[] = sourcesRes.data || [];
  const alerts: Alert[] = alertsRes.data || [];
  const exclusions: Exclusion[] = exclusionsRes.data || [];

  const { data: digest, error: digestError } = await supabase
    .from("digests")
    .insert({
      user_id: userId,
      type,
      status: "processing",
      digest_config_id: digestConfigId || null,
      metadata: { progress: 5, stage: "Carregando configuracao...", source_results: [] },
    })
    .select()
    .single();

  if (digestError || !digest) throw new Error(`Failed to create digest: ${digestError?.message}`);

  return { digestId: digest.id, settings, topics, sources, alerts, exclusions };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sanitize an ID that should be a UUID or null — guards against model hallucinations. */
function safeId(id: string | null | undefined, allowedIds?: Set<string>): string | null {
  if (!id || id === "null" || id === "none" || !UUID_RE.test(id)) return null;
  if (allowedIds && !allowedIds.has(id)) return null;
  return id;
}

/**
 * Insert article rows with graceful fallback: try batch first, then row-by-row on failure.
 * This prevents one invalid row from silently discarding the entire batch.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertArticlesSafe(supabase: any, rows: Record<string, unknown>[]): Promise<void> {
  const { error } = await supabase.from("articles").insert(rows);
  if (!error) return;

  console.error("Batch article insert failed, falling back to row-by-row:", error.message);
  let saved = 0;
  for (const row of rows) {
    const { error: rowErr } = await supabase.from("articles").insert(row);
    if (rowErr) console.error("Row insert failed:", rowErr.message, "title:", row.title);
    else saved++;
  }
  console.log(`Row-by-row fallback: saved ${saved}/${rows.length} articles`);
}

/**
 * Match a processed article to an alert based on keyword overlap with the alert query.
 * Returns the alert ID if a match is found, null otherwise.
 */
function matchArticleToAlerts(article: { title: string; summary: string }, alerts: Alert[]): string | null {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  for (const alert of alerts) {
    if (!alert.is_active) continue;
    if (alert.expires_at && new Date(alert.expires_at) <= new Date()) continue;
    const queryWords = alert.query
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3);
    if (queryWords.length === 0) continue;
    const matches = queryWords.filter((w) => text.includes(w));
    if (matches.length / queryWords.length >= 0.5) return alert.id;
  }
  return null;
}

/**
 * Run the full digest pipeline for an existing digest record.
 * Writes progress updates to the DB throughout. Safe to call as fire-and-forget.
 */
export async function runDigestPipeline(
  digestId: string,
  userId: string,
  digestConfigId: string | undefined,
  settings: Settings,
  topics: Topic[],
  sources: RssSource[],
  alerts: Alert[],
  exclusions: Exclusion[]
): Promise<void> {
  const supabase = getServiceClient();

  const progressMeta: Record<string, unknown> = { progress: 5, stage: "Carregando configuracao...", source_results: [] };

  async function updateProgress(progress: number, stage: string, extra?: Record<string, unknown>) {
    progressMeta.progress = progress;
    progressMeta.stage = stage;
    if (extra) Object.assign(progressMeta, extra);
    await supabase.from("digests").update({ metadata: { ...progressMeta } }).eq("id", digestId);
  }

  try {
    let allRaw: RawArticle[] = [];
    const sourceResults: { name: string; type: string; status: "ok" | "error" | "empty"; count: number; error?: string }[] = [];

    await updateProgress(10, "Buscando artigos...");

    // ── Trends mode: deep multi-angle search for one topic ──────────
    if (settings.digest_type === "trends" && settings.trend_topic) {
      const topic = settings.trend_topic;
      const { searchAllTopics } = await import("@/lib/sources/search");

      await updateProgress(15, `Gerando ângulos de busca para "${topic}"...`);
      const searchAngles = await generateTrendsSearchAngles(
        topic,
        settings.trend_keywords ?? [],
        settings.language
      );

      await updateProgress(20, `Buscando cobertura ampla sobre "${topic}"...`);
      allRaw = await searchAllTopics(searchAngles);

      if (allRaw.length > 0) {
        sourceResults.push({ name: `Trends: ${topic}`, type: "search", status: "ok", count: allRaw.length });
      }

      await updateProgress(45, `${allRaw.length} artigos encontrados. Filtrando...`, { source_results: sourceResults });

      const filtered = filterArticles(allRaw, exclusions).slice(0, Math.max(settings.max_articles, 30));

      if (filtered.length === 0) {
        await supabase.from("digests").update({
          status: "completed",
          summary: `Nenhuma cobertura encontrada para o tema "${topic}".`,
          metadata: { progress: 100, stage: "Concluido", source_results: sourceResults, total_articles: 0 },
        }).eq("id", digestId);
        return;
      }

      await updateProgress(55, `Extraindo matéria completa de ${filtered.length} artigos...`, { source_results: sourceResults });
      const enriched = await enrichArticles(filtered);

      if (enriched.length > 0 && digestConfigId) {
        const rows = enriched.map((a) => ({
          digest_config_id: digestConfigId,
          url: a.url, title: a.title, content: a.content || null,
          full_content: a.full_content || null, source_name: a.source_name,
          image_url: a.image_url || null, published_at: a.published_at || null,
          fetched_at: new Date().toISOString(),
        }));
        await supabase.from("fetched_articles").upsert(rows, { onConflict: "digest_config_id,url" });
      }

      await updateProgress(63, `Removendo publicidade de ${enriched.length} artigos...`, { source_results: sourceResults });
      const cleaned = await cleanArticlesContent(enriched);

      // For trends, create a single "trends" topic for classification
      const trendsTopics: Topic[] = [{
        id: "trends", user_id: userId, digest_config_id: digestConfigId ?? "",
        name: topic, keywords: settings.trend_keywords ?? [topic],
        priority: "high", is_active: true, created_at: new Date().toISOString(),
      }];

      await updateProgress(70, `Analisando ${cleaned.length} artigos com IA...`, { source_results: sourceResults });
      const processed = await processArticles(cleaned, trendsTopics, settings.language, settings.summary_style, sources);

      // Match articles to active alerts
      for (const article of processed) {
        article.alert_id = matchArticleToAlerts(article, alerts);
      }

      // Drop zero-relevance articles
      const trendsPublishable = processed.filter((a) => a.relevance_score > 0);

      await updateProgress(80, "Salvando artigos...", { source_results: sourceResults });
      const trendsTopicIds = new Set(trendsTopics.map((t) => t.id));
      const alertIds = new Set(alerts.map((a) => a.id));
      const articleRows = trendsPublishable.map((a) => ({
        digest_id: digestId,
        topic_id: safeId(a.topic_id, trendsTopicIds),
        alert_id: safeId(a.alert_id, alertIds),
        title: a.title, source_name: a.source_name, source_url: a.source_url,
        summary: a.summary, key_quote: a.key_quote, full_content: a.full_content,
        relevance_score: a.relevance_score, is_highlight: a.is_highlight,
        image_url: a.image_url, published_at: a.published_at,
      }));
      await insertArticlesSafe(supabase, articleRows);

      await updateProgress(88, "Gerando briefing do tema...", { source_results: sourceResults });
      const daySummary = await generateTrendsBriefing(processed.map((a) => a.summary), topic, settings.language);

      const metadata: DigestMetadata = {
        total_articles: processed.length,
        sources_count: new Set(processed.map((a) => a.source_name)).size,
        topics_count: 1,
        source_results: sourceResults,
      };
      await supabase.from("digests").update({
        status: "completed", summary: daySummary,
        metadata: { ...metadata, progress: 100, stage: "Concluido" },
      }).eq("id", digestId);
      return;
    }
    // ── End trends mode ──────────────────────────────────────────────

    // Try pre-fetched articles first (last 7 days)
    if (digestConfigId) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: storedRows } = await supabase
        .from("fetched_articles")
        .select("title, url, content, full_content, source_name, image_url, published_at")
        .eq("digest_config_id", digestConfigId)
        .gte("fetched_at", sevenDaysAgo)
        .order("fetched_at", { ascending: false })
        .limit(300);

      if (storedRows && storedRows.length > 0) {
        allRaw = storedRows.map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content || "",
          full_content: r.full_content ?? undefined,
          source_name: r.source_name,
          image_url: r.image_url ?? undefined,
          published_at: r.published_at ?? undefined,
        }));

        const bySrc = new Map<string, number>();
        for (const a of allRaw) bySrc.set(a.source_name, (bySrc.get(a.source_name) || 0) + 1);
        for (const [name, count] of bySrc) {
          sourceResults.push({ name, type: "cache", status: "ok", count });
        }
      }
    }

    // Fall back to live fetch if no pre-fetched articles
    if (allRaw.length === 0) {
      await updateProgress(15, "Buscando fontes ao vivo...");

      const rssSources = sources.filter((s) => s.source_type !== "web");
      const webSources = sources.filter((s) => s.source_type === "web");

      const rssResults = await Promise.allSettled(
        rssSources.map(async (s) => {
          const { fetchRssFeed } = await import("@/lib/sources/rss");
          const articles = await fetchRssFeed(s.url, s.name);
          return { source: s, articles };
        })
      );

      const rssArticles: RawArticle[] = [];
      for (let i = 0; i < rssResults.length; i++) {
        const result = rssResults[i];
        const source = rssSources[i];
        if (result.status === "fulfilled" && result.value.articles.length > 0) {
          const cap = source.weight * 2 || 6;
          const capped = result.value.articles.slice(0, cap);
          rssArticles.push(...capped);
          sourceResults.push({ name: source.name, type: "rss", status: "ok", count: capped.length });
        } else {
          const errMsg = result.status === "rejected" ? String(result.reason) : "Nenhum artigo encontrado";
          sourceResults.push({ name: source.name, type: "rss", status: result.status === "rejected" ? "error" : "empty", count: 0, error: errMsg });
        }
      }

      await updateProgress(35, "Buscando fontes web...", { source_results: sourceResults });

      const webResults = await Promise.allSettled(
        webSources.map(async (s) => {
          const domain = s.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
          const { deepFetchSource } = await import("@/lib/sources/deep-fetch");

          const deep = await deepFetchSource(domain, s.name);
          if (deep.length > 0) return { source: s, articles: deep, method: "deep-fetch" };

          const linkedTopic = topics.find((t) => t.id === s.topic_id);
          const keywords = linkedTopic ? linkedTopic.keywords.slice(0, 3).join(" ") : s.name;
          const lang = settings.language === "pt-BR" ? "noticias" : "news";
          const maxResults = s.weight >= 4 ? 8 : s.weight >= 2 ? 5 : 3;
          const { searchAllTopics: search } = await import("@/lib/sources/search");
          const tavily = await search([{ query: `${keywords} ${lang}`, maxResults, includeDomains: [domain], searchDepth: "advanced" }]);
          if (tavily.length > 0) return { source: s, articles: tavily, method: "tavily" };

          const { scrapeWebSource } = await import("@/lib/sources/scraper");
          const scraped = await scrapeWebSource(domain, s.name);
          return { source: s, articles: scraped, method: "scraper" };
        })
      );

      const webArticles: RawArticle[] = [];
      for (let i = 0; i < webResults.length; i++) {
        const result = webResults[i];
        const source = webSources[i];
        if (result.status === "fulfilled" && result.value.articles.length > 0) {
          webArticles.push(...result.value.articles);
          sourceResults.push({ name: source.name, type: "web", status: "ok", count: result.value.articles.length });
        } else {
          const errMsg = result.status === "rejected" ? String(result.reason) : "Nenhum artigo extraido";
          sourceResults.push({ name: source.name, type: "web", status: result.status === "rejected" ? "error" : "empty", count: 0, error: errMsg });
        }
      }

      await updateProgress(50, "Buscando topicos...", { source_results: sourceResults });

      const topicQueries = topics.flatMap((t) => {
        const maxResults = t.priority === "high" ? 8 : t.priority === "medium" ? 5 : 3;
        const topKeywords = t.keywords.slice(0, 3).join(" ");
        const lang = settings.language === "pt-BR" ? "Brasil noticias" : "news";
        return [{ query: `${topKeywords} ${lang}`, maxResults }];
      });
      const alertQueries = alerts
        .filter((a) => !a.expires_at || new Date(a.expires_at) > new Date())
        .map((a) => ({ query: a.query, maxResults: 5 }));

      const { searchAllTopics } = await import("@/lib/sources/search");
      const topicArticles = await searchAllTopics(topicQueries.concat(alertQueries));

      if (topicArticles.length > 0) {
        sourceResults.push({ name: "Busca por topicos", type: "search", status: "ok", count: topicArticles.length });
      } else if (topicQueries.length > 0) {
        sourceResults.push({ name: "Busca por topicos", type: "search", status: "empty", count: 0 });
      }

      allRaw = [...webArticles, ...topicArticles, ...rssArticles];
    }

    await updateProgress(50, `${allRaw.length} artigos encontrados. Filtrando...`, { source_results: sourceResults });

    const filtered = filterArticles(allRaw, exclusions).slice(0, Math.max(settings.max_articles, 30));

    if (filtered.length === 0) {
      await supabase.from("digests").update({
        status: "completed",
        summary: "Nenhuma noticia encontrada para hoje.",
        metadata: { progress: 100, stage: "Concluido", source_results: sourceResults, total_articles: 0 },
      }).eq("id", digestId);
      return;
    }

    await updateProgress(55, `Extraindo materia completa de ${filtered.length} artigos...`, { source_results: sourceResults });

    const enriched = await enrichArticles(filtered);

    // Store raw content in cache BEFORE cleaning — preserves original as backup
    if (enriched.length > 0 && digestConfigId) {
      const rows = enriched.map((a) => ({
        digest_config_id: digestConfigId,
        url: a.url,
        title: a.title,
        content: a.content || null,
        full_content: a.full_content || null,
        source_name: a.source_name,
        image_url: a.image_url || null,
        published_at: a.published_at || null,
        fetched_at: new Date().toISOString(),
      }));
      await supabase
        .from("fetched_articles")
        .upsert(rows, { onConflict: "digest_config_id,url" });
    }

    await updateProgress(63, `Removendo publicidade de ${enriched.length} artigos...`, { source_results: sourceResults });

    const cleaned = await cleanArticlesContent(enriched);

    await updateProgress(70, `Analisando ${cleaned.length} artigos com IA...`, { source_results: sourceResults });

    const processed = await processArticles(cleaned, topics, settings.language, settings.summary_style, sources);

    // Match articles to active alerts
    for (const article of processed) {
      article.alert_id = matchArticleToAlerts(article, alerts);
    }

    // Drop articles with zero relevance — these are empty/cookie-only pages that slipped through
    const publishable = processed.filter((a) => a.relevance_score > 0);

    await updateProgress(80, "Salvando artigos...", { source_results: sourceResults });

    const topicIds = new Set(topics.map((t) => t.id));
    const alertIds = new Set(alerts.map((a) => a.id));
    const articleRows = publishable.map((a) => ({
      digest_id: digestId,
      topic_id: safeId(a.topic_id, topicIds),
      alert_id: safeId(a.alert_id, alertIds),
      title: a.title,
      source_name: a.source_name,
      source_url: a.source_url,
      summary: a.summary,
      key_quote: a.key_quote,
      full_content: a.full_content,
      relevance_score: a.relevance_score,
      is_highlight: a.is_highlight,
      image_url: a.image_url,
      published_at: a.published_at,
    }));

    await insertArticlesSafe(supabase, articleRows);

    await updateProgress(85, "Gerando resumo do dia...", { source_results: sourceResults });

    const daySummary = await generateDaySummary(publishable.map((a) => a.summary), settings.language);
    const trends = await computeTrends(digestConfigId ?? "", digestId, supabase);

    const metadata: DigestMetadata = {
      total_articles: publishable.length,
      sources_count: new Set(publishable.map((a) => a.source_name)).size,
      topics_count: new Set(publishable.filter((a) => a.topic_id).map((a) => a.topic_id)).size,
      ...(trends.length > 0 ? { trends } : {}),
      source_results: sourceResults,
    };

    await supabase.from("digests").update({
      status: "completed",
      summary: daySummary,
      metadata: { ...metadata, progress: 100, stage: "Concluido" },
    }).eq("id", digestId);
  } catch (error) {
    await supabase.from("digests").update({
      status: "failed",
      metadata: { error: String(error), progress: 100, stage: `Erro: ${String(error).slice(0, 100)}` },
    }).eq("id", digestId);
    throw error;
  }
}

/**
 * Combined helper for cron/scheduled use — creates record + runs pipeline synchronously.
 */
export async function generateDigest(userId: string, type: "scheduled" | "on_demand", digestConfigId?: string): Promise<string> {
  const { digestId, settings, topics, sources, alerts, exclusions } = await initializeDigest(userId, type, digestConfigId);
  await runDigestPipeline(digestId, userId, digestConfigId, settings, topics, sources, alerts, exclusions);
  return digestId;
}
