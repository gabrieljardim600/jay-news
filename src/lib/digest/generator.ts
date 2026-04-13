import { createClient } from "@supabase/supabase-js";
import { fetchAllRssFeeds } from "@/lib/sources/rss";
import { searchAllTopics } from "@/lib/sources/search";
import { filterArticles } from "@/lib/digest/filter";
import { processArticles, generateDaySummary } from "@/lib/digest/processor";
import type { Topic, RssSource, Alert, Exclusion, UserSettings } from "@/types";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function generateDigest(userId: string, type: "scheduled" | "on_demand"): Promise<string> {
  const supabase = getServiceClient();

  const [settingsRes, topicsRes, sourcesRes, alertsRes, exclusionsRes] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", userId).single(),
    supabase.from("topics").select("*").eq("user_id", userId).eq("is_active", true),
    supabase.from("rss_sources").select("*").eq("user_id", userId).eq("is_active", true),
    supabase.from("alerts").select("*").eq("user_id", userId).eq("is_active", true),
    supabase.from("exclusions").select("*").eq("user_id", userId).eq("is_active", true),
  ]);

  const settings: UserSettings = settingsRes.data || {
    user_id: userId, digest_time: "07:00", language: "pt-BR", summary_style: "executive",
    max_articles: 20, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  const topics: Topic[] = topicsRes.data || [];
  const sources: RssSource[] = sourcesRes.data || [];
  const alerts: Alert[] = alertsRes.data || [];
  const exclusions: Exclusion[] = exclusionsRes.data || [];

  const { data: digest, error: digestError } = await supabase
    .from("digests")
    .insert({ user_id: userId, type, status: "processing" })
    .select()
    .single();

  if (digestError || !digest) throw new Error(`Failed to create digest: ${digestError?.message}`);

  try {
    const rssFeeds = sources.map((s) => ({ url: s.url, name: s.name }));

    // Build focused search queries per topic using top 3 keywords + language context
    const topicQueries = topics.flatMap((t) => {
      const maxResults = t.priority === "high" ? 8 : t.priority === "medium" ? 5 : 3;
      const topKeywords = t.keywords.slice(0, 3).join(" ");
      const lang = settings.language === "pt-BR" ? "Brasil noticias" : "news";
      return [{ query: `${topKeywords} ${lang}`, maxResults }];
    });

    // Dedicated The News search — priority source, always included
    const theNewsQueries = [
      { query: "the news newsletter brasil hoje", maxResults: 5, includeDomains: ["thenewscc.beehiiv.com"] },
    ];

    // Alert queries
    const alertQueries = alerts
      .filter((a) => !a.expires_at || new Date(a.expires_at) > new Date())
      .map((a) => ({ query: a.query, maxResults: 5 }));

    const searchQueries = [...theNewsQueries, ...topicQueries, ...alertQueries];

    const [rssArticles, searchArticles] = await Promise.all([
      fetchAllRssFeeds(rssFeeds),
      searchAllTopics(searchQueries),
    ]);

    // Interleave to ensure topic-based Tavily results aren't all cut off by RSS volume
    // Cap RSS per-source at 5 to prevent any single feed from dominating
    const cappedRss = Object.values(
      rssArticles.reduce<Record<string, typeof rssArticles>>((acc, a) => {
        if (!acc[a.source_name]) acc[a.source_name] = [];
        if (acc[a.source_name].length < 5) acc[a.source_name].push(a);
        return acc;
      }, {})
    ).flat();

    // Tavily results first, then RSS — ensures topic searches are represented
    const allRaw = [...searchArticles, ...cappedRss];
    const filtered = filterArticles(allRaw, exclusions).slice(0, Math.max(settings.max_articles, 30));

    if (filtered.length === 0) {
      await supabase.from("digests").update({ status: "completed", summary: "Nenhuma noticia encontrada para hoje." }).eq("id", digest.id);
      return digest.id;
    }

    const processed = await processArticles(filtered, topics, settings.language, settings.summary_style);

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
