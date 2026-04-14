import { fetchAllRssFeeds } from "@/lib/sources/rss";
import { searchAllTopics } from "@/lib/sources/search";
import { scrapeWebSource } from "@/lib/sources/scraper";
import { deepFetchSource } from "@/lib/sources/deep-fetch";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RawArticle, Topic, RssSource, Alert } from "@/types";

export async function fetchRawArticles(
  topics: Topic[],
  sources: RssSource[],
  alerts: Alert[],
  language: string
): Promise<RawArticle[]> {
  const rssSources = sources.filter((s) => s.source_type !== "web");
  const webSources = sources.filter((s) => s.source_type === "web");
  const sourceByName = Object.fromEntries(sources.map((s) => [s.name, s]));

  const rssFeeds = rssSources.map((s) => ({ url: s.url, name: s.name }));

  const topicQueries = topics.flatMap((t) => {
    const maxResults = t.priority === "high" ? 8 : t.priority === "medium" ? 5 : 3;
    const topKeywords = t.keywords.slice(0, 3).join(" ");
    const lang = language === "pt-BR" ? "Brasil noticias" : "news";
    return [{ query: `${topKeywords} ${lang}`, maxResults }];
  });

  const alertQueries = alerts
    .filter((a) => !a.expires_at || new Date(a.expires_at) > new Date())
    .map((a) => ({ query: a.query, maxResults: 5 }));

  // Web sources: deep fetch (Jina archive → extract editions → extract stories)
  // Falls back to Tavily Advanced, then to scraper
  const webSourceResults = await Promise.allSettled(
    webSources.map(async (s) => {
      const domain = s.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

      // Stage 1: Try deep fetch (two-stage: archive → editions → stories)
      const deep = await deepFetchSource(domain, s.name);
      if (deep.length > 0) return deep;

      // Stage 2: Tavily Advanced with domain filter
      const linkedTopic = topics.find((t) => t.id === s.topic_id);
      const keywords = linkedTopic ? linkedTopic.keywords.slice(0, 3).join(" ") : s.name;
      const lang = language === "pt-BR" ? "noticias" : "news";
      const maxResults = s.weight >= 4 ? 8 : s.weight >= 2 ? 5 : 3;
      const { searchAllTopics: search } = await import("@/lib/sources/search");
      const tavily = await search([{
        query: `${keywords} ${lang}`,
        maxResults,
        includeDomains: [domain],
        searchDepth: "advanced",
      }]);
      if (tavily.length > 0) return tavily;

      // Stage 3: Jina + AI scraper fallback
      return scrapeWebSource(domain, s.name);
    })
  );
  const webArticles = webSourceResults.flatMap((r) => r.status === "fulfilled" ? r.value : []);

  const [rssArticles, topicArticles] = await Promise.all([
    fetchAllRssFeeds(rssFeeds),
    searchAllTopics(topicQueries.concat(alertQueries)),
  ]);

  // Cap RSS per-source by weight (weight * 2, default cap 6)
  const cappedRss = Object.values(
    rssArticles.reduce<Record<string, typeof rssArticles>>((acc, a) => {
      const source = sourceByName[a.source_name];
      const cap = source ? source.weight * 2 : 6;
      if (!acc[a.source_name]) acc[a.source_name] = [];
      if (acc[a.source_name].length < cap) acc[a.source_name].push(a);
      return acc;
    }, {})
  ).flat();

  return [...webArticles, ...topicArticles, ...cappedRss];
}

export async function fetchAndStore(
  digestConfigId: string,
  supabase: SupabaseClient
): Promise<{ fetched: number; stored: number }> {
  const [topicsRes, sourcesRes, alertsRes, configRes] = await Promise.all([
    supabase.from("topics").select("*").eq("digest_config_id", digestConfigId).eq("is_active", true),
    supabase.from("rss_sources").select("*").eq("digest_config_id", digestConfigId).eq("is_active", true),
    supabase.from("alerts").select("*").eq("digest_config_id", digestConfigId).eq("is_active", true),
    supabase.from("digest_configs").select("language").eq("id", digestConfigId).single(),
  ]);

  const topics: Topic[] = topicsRes.data || [];
  const sources: RssSource[] = sourcesRes.data || [];
  const alerts: Alert[] = alertsRes.data || [];
  const language: string = configRes.data?.language || "pt-BR";

  const articles = await fetchRawArticles(topics, sources, alerts, language);
  if (articles.length === 0) return { fetched: 0, stored: 0 };

  const rows = articles.map((a) => ({
    digest_config_id: digestConfigId,
    url: a.url,
    title: a.title,
    content: a.content || null,
    source_name: a.source_name,
    image_url: a.image_url || null,
    published_at: a.published_at || null,
    fetched_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("fetched_articles")
    .upsert(rows, { onConflict: "digest_config_id,url" });

  if (error) {
    console.error(`fetchAndStore error for ${digestConfigId}:`, error);
    return { fetched: articles.length, stored: 0 };
  }

  return { fetched: articles.length, stored: rows.length };
}
