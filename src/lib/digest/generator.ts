import { createClient } from "@supabase/supabase-js";
import { fetchRawArticles } from "@/lib/sources/fetcher";
import { filterArticles } from "@/lib/digest/filter";
import { processArticles, generateDaySummary } from "@/lib/digest/processor";
import type { RawArticle, Topic, RssSource, Alert, Exclusion } from "@/types";

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
    .insert({ user_id: userId, type, status: "processing", digest_config_id: digestConfigId || null })
    .select()
    .single();

  if (digestError || !digest) throw new Error(`Failed to create digest: ${digestError?.message}`);

  try {
    let allRaw: RawArticle[] = [];

    // Try pre-fetched articles first (last 7 days)
    if (digestConfigId) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: storedRows } = await supabase
        .from("fetched_articles")
        .select("title, url, content, source_name, image_url, published_at")
        .eq("digest_config_id", digestConfigId)
        .gte("fetched_at", sevenDaysAgo)
        .order("fetched_at", { ascending: false })
        .limit(300);

      if (storedRows && storedRows.length > 0) {
        allRaw = storedRows.map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content || "",
          source_name: r.source_name,
          image_url: r.image_url ?? undefined,
          published_at: r.published_at ?? undefined,
        }));
      }
    }

    // Fall back to live fetch if no pre-fetched articles
    if (allRaw.length === 0) {
      allRaw = await fetchRawArticles(topics, sources, alerts, settings.language);

      // Store for future use
      if (allRaw.length > 0 && digestConfigId) {
        const rows = allRaw.map((a) => ({
          digest_config_id: digestConfigId,
          url: a.url,
          title: a.title,
          content: a.content || null,
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

    const filtered = filterArticles(allRaw, exclusions).slice(0, Math.max(settings.max_articles, 30));

    if (filtered.length === 0) {
      await supabase.from("digests").update({ status: "completed", summary: "Nenhuma noticia encontrada para hoje." }).eq("id", digest.id);
      return digest.id;
    }

    const processed = await processArticles(filtered, topics, settings.language, settings.summary_style, sources);

    const articleRows = processed.map((a) => ({
      digest_id: digest.id,
      topic_id: a.topic_id,
      alert_id: a.alert_id,
      title: a.title,
      source_name: a.source_name,
      source_url: a.source_url,
      summary: a.summary,
      relevance_score: a.relevance_score,
      is_highlight: a.is_highlight,
      image_url: a.image_url,
      published_at: a.published_at,
    }));

    await supabase.from("articles").insert(articleRows);

    const daySummary = await generateDaySummary(processed.map((a) => a.summary), settings.language);

    await supabase.from("digests").update({
      status: "completed",
      summary: daySummary,
      metadata: {
        total_articles: processed.length,
        sources_count: new Set(processed.map((a) => a.source_name)).size,
        topics_count: new Set(processed.filter((a) => a.topic_id).map((a) => a.topic_id)).size,
      },
    }).eq("id", digest.id);

    return digest.id;
  } catch (error) {
    await supabase.from("digests").update({ status: "failed", metadata: { error: String(error) } }).eq("id", digest.id);
    throw error;
  }
}
