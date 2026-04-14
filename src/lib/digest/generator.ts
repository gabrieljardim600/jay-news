import { createClient } from "@supabase/supabase-js";
import { filterArticles } from "@/lib/digest/filter";
import { processArticles, generateDaySummary } from "@/lib/digest/processor";
import { computeTrends } from "@/lib/digest/trends";
import type { RawArticle, Topic, RssSource, Alert, Exclusion, DigestMetadata } from "@/types";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function generateDigest(userId: string, type: "scheduled" | "on_demand", digestConfigId?: string): Promise<string> {
  const supabase = getServiceClient();

  // Load digest config settings
  let settings: { language: string; summary_style: string; max_articles: number };

  if (digestConfigId) {
    const { data: config } = await supabase
      .from("digest_configs")
      .select("language, summary_style, max_articles")
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

  // Load config-scoped data
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
    .insert({ user_id: userId, type, status: "processing", digest_config_id: digestConfigId || null, metadata: { progress: 5, stage: "Carregando configuracao...", source_results: [] } })
    .select()
    .single();

  if (digestError || !digest) throw new Error(`Failed to create digest: ${digestError?.message}`);

  // Mutable progress state
  const progressMeta: Record<string, unknown> = { progress: 5, stage: "Carregando configuracao...", source_results: [] };

  async function updateProgress(progress: number, stage: string, extra?: Record<string, unknown>) {
    progressMeta.progress = progress;
    progressMeta.stage = stage;
    if (extra) Object.assign(progressMeta, extra);
    await supabase.from("digests").update({
      metadata: { ...progressMeta },
    }).eq("id", digest.id);
  }

  try {
    let allRaw: RawArticle[] = [];
    const sourceResults: { name: string; type: string; status: "ok" | "error" | "empty"; count: number; error?: string }[] = [];

    await updateProgress(10, "Buscando artigos...");

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

        // Report cached sources
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

      // Fetch each source type separately for per-source error tracking
      const rssSources = sources.filter((s) => s.source_type !== "web");
      const webSources = sources.filter((s) => s.source_type === "web");

      // RSS sources — individual tracking
      const rssResults = await Promise.allSettled(
        rssSources.map(async (s) => {
          const { fetchRssFeed } = await import("@/lib/sources/rss");
          const articles = await fetchRssFeed(s.url, s.name);
          return { source: s, articles };
        })
      );

      const rssArticles: RawArticle[] = [];
      const sourceByName = Object.fromEntries(sources.map((s) => [s.name, s]));
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

      // Web sources — individual tracking
      const webResults = await Promise.allSettled(
        webSources.map(async (s) => {
          const domain = s.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
          const { deepFetchSource } = await import("@/lib/sources/deep-fetch");

          // Stage 1: deep fetch
          const deep = await deepFetchSource(domain, s.name);
          if (deep.length > 0) return { source: s, articles: deep, method: "deep-fetch" };

          // Stage 2: Tavily Advanced
          const linkedTopic = topics.find((t) => t.id === s.topic_id);
          const keywords = linkedTopic ? linkedTopic.keywords.slice(0, 3).join(" ") : s.name;
          const lang = settings.language === "pt-BR" ? "noticias" : "news";
          const maxResults = s.weight >= 4 ? 8 : s.weight >= 2 ? 5 : 3;
          const { searchAllTopics: search } = await import("@/lib/sources/search");
          const tavily = await search([{ query: `${keywords} ${lang}`, maxResults, includeDomains: [domain], searchDepth: "advanced" }]);
          if (tavily.length > 0) return { source: s, articles: tavily, method: "tavily" };

          // Stage 3: scraper
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

      // Topic and alert searches
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

      // Store for future use
      if (allRaw.length > 0 && digestConfigId) {
        const rows = allRaw.map((a) => ({
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
    }

    await updateProgress(55, `${allRaw.length} artigos encontrados. Filtrando...`, { source_results: sourceResults });

    const filtered = filterArticles(allRaw, exclusions).slice(0, Math.max(settings.max_articles, 30));

    if (filtered.length === 0) {
      await supabase.from("digests").update({
        status: "completed",
        summary: "Nenhuma noticia encontrada para hoje.",
        metadata: { progress: 100, stage: "Concluido", source_results: sourceResults, total_articles: 0 },
      }).eq("id", digest.id);
      return digest.id;
    }

    await updateProgress(60, `Processando ${filtered.length} artigos com IA...`, { source_results: sourceResults });

    const processed = await processArticles(filtered, topics, settings.language, settings.summary_style, sources);

    await updateProgress(80, "Salvando artigos...", { source_results: sourceResults });

    const articleRows = processed.map((a) => ({
      digest_id: digest.id,
      topic_id: a.topic_id,
      alert_id: a.alert_id,
      title: a.title,
      source_name: a.source_name,
      source_url: a.source_url,
      summary: a.summary,
      full_content: a.full_content,
      relevance_score: a.relevance_score,
      is_highlight: a.is_highlight,
      image_url: a.image_url,
      published_at: a.published_at,
    }));

    await supabase.from("articles").insert(articleRows);

    await updateProgress(85, "Gerando resumo do dia...", { source_results: sourceResults });

    const daySummary = await generateDaySummary(processed.map((a) => a.summary), settings.language);
    const trends = await computeTrends(digestConfigId ?? "", digest.id, supabase);

    const metadata: DigestMetadata = {
      total_articles: processed.length,
      sources_count: new Set(processed.map((a) => a.source_name)).size,
      topics_count: new Set(processed.filter((a) => a.topic_id).map((a) => a.topic_id)).size,
      ...(trends.length > 0 ? { trends } : {}),
      source_results: sourceResults,
    };

    await supabase.from("digests").update({
      status: "completed",
      summary: daySummary,
      metadata: { ...metadata, progress: 100, stage: "Concluido" },
    }).eq("id", digest.id);

    return digest.id;
  } catch (error) {
    await supabase.from("digests").update({
      status: "failed",
      metadata: { error: String(error), progress: 100, stage: `Erro: ${String(error).slice(0, 100)}` },
    }).eq("id", digest.id);
    throw error;
  }
}
