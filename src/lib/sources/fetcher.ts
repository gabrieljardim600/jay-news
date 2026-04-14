import { fetchAllRssFeeds } from "@/lib/sources/rss";
import { searchAllTopics } from "@/lib/sources/search";
import { scrapeWebSource } from "@/lib/sources/scraper";
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

  // Web sources: Tavily advanced search per domain, using linked topic keywords or source name
  const webQueries = webSources.flatMap((s) => {
    const linkedTopic = topics.find((t) => t.id === s.topic_id);
    const keywords = linkedTopic ? linkedTopic.keywords.slice(0, 3).join(" ") : s.name;
    const lang = language === "pt-BR" ? "noticias" : "news";
    const maxResults = s.weight >= 4 ? 8 : s.weight >= 2 ? 5 : 3;
    const domain = s.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    return [{
      query: `${keywords} ${lang}`,
      maxResults,
      includeDomains: [domain],
      searchDepth: "advanced" as const,
    }];
  });

  const theNewsQueries = [
    { query: "the news newsletter brasil hoje", maxResults: 5, includeDomains: ["thenewscc.beehiiv.com"] },
  ];

  const alertQueries = alerts
    .filter((a) => !a.expires_at || new Date(a.expires_at) > new Date())
    .map((a) => ({ query: a.query, maxResults: 5 }));

  const [rssArticles, searchArticles] = await Promise.all([
    fetchAllRssFeeds(rssFeeds),
    searchAllTopics([...theNewsQueries, ...topicQueries, ...webQueries, ...alertQueries]),
  ]);

  // Fallback: for web sources that Tavily didn't find results for, try scraping
  const tavilyCoveredDomains = new Set(
    searchArticles.map((a) => {
      try { return new URL(a.url).hostname.replace("www.", ""); } catch { return ""; }
    })
  );

  const uncoveredWebSources = webSources.filter((s) => {
    const domain = s.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    return !tavilyCoveredDomains.has(domain) && !tavilyCoveredDomains.has(`www.${domain}`);
  });

  let scraperArticles: RawArticle[] = [];
  if (uncoveredWebSources.length > 0) {
    const scrapeResults = await Promise.allSettled(
      uncoveredWebSources.map((s) => {
        const domain = s.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        return scrapeWebSource(domain, s.name);
      })
    );
    scraperArticles = scrapeResults.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  }

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

  return [...searchArticles, ...scraperArticles, ...cappedRss];
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
