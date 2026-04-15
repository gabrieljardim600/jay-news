import type { RawArticle } from "@/types";
import { searchTavily } from "@/lib/sources/search";
import { fetchRssFeed } from "@/lib/sources/rss";
import { filterArticles, looksPortuguese } from "@/lib/digest/filter";
import { BR_NEWS_DOMAINS } from "@/lib/digest/processor";
import { findMentions, type CompetitorRef } from "./competitor-matcher";

type MarketRow = {
  id: string;
  name: string;
  description: string | null;
  language: string;
};

type SubtopicRow = { id: string; label: string };

type CompetitorRow = {
  id: string;
  name: string;
  website: string | null;
  aliases: string[];
  enabled: boolean;
};

type SourceRow = {
  id: string;
  name: string;
  url: string;
  source_type: "rss" | "web";
  enabled: boolean;
};

export type CollectedArticle = {
  title: string;
  source_name: string;
  source_url: string;
  summary: string | null;
  image_url: string | null;
  published_at: string | null;
  relevance_score: number;
  mentioned_competitor_ids: string[];
  found_via: "general" | "competitor";
};

export type CollectInput = {
  market: MarketRow;
  subtopics: SubtopicRow[];
  competitors: CompetitorRow[];
  sources: SourceRow[];
};

/** Normalize a URL for dedup: lowercase host, strip trailing slash + common tracking params. */
function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    const drop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
    for (const p of drop) u.searchParams.delete(p);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "") || "/";
    const qs = u.searchParams.toString();
    return `${u.protocol}//${u.hostname}${path}${qs ? "?" + qs : ""}`;
  } catch {
    return raw.toLowerCase().replace(/\/+$/, "");
  }
}

function cleanTerm(s: string): string {
  return s.replace(/[&|]/g, " ").replace(/\s+/g, " ").trim();
}

function buildGeneralQueries(market: MarketRow, subtopics: SubtopicRow[]): string[] {
  const base = cleanTerm(market.name);
  const region = market.language === "pt-BR" ? " Brasil" : "";
  const labels = subtopics.map((s) => cleanTerm(s.label)).filter(Boolean);
  if (labels.length === 0) return [`${base}${region}`];
  // One focused query per subtopic with market + region context
  return labels.slice(0, 6).map((label) => `${base} ${label}${region}`);
}

function competitorQuery(market: MarketRow, c: CompetitorRow, subtopics: SubtopicRow[]): string {
  const region = market.language === "pt-BR" ? " Brasil" : "";
  const label = subtopics[0]?.label ? ` ${cleanTerm(subtopics[0].label)}` : "";
  const marketContext = ` ${cleanTerm(market.name)}`;
  return `${c.name}${marketContext}${label}${region}`;
}

function domainFromWebsite(website: string | null): string | null {
  if (!website) return null;
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function collectForMarket({ market, subtopics, competitors, sources }: CollectInput): Promise<CollectedArticle[]> {
  const isPt = market.language === "pt-BR";
  const enabledCompetitors = competitors.filter((c) => c.enabled);
  const enabledSources = sources.filter((s) => s.enabled);

  const competitorRefs: CompetitorRef[] = enabledCompetitors.map((c) => ({
    id: c.id,
    name: c.name,
    website: c.website,
    aliases: c.aliases || [],
  }));

  // ── 1. General feed: Tavily + optional RSS/web sources
  const generalBuckets: RawArticle[][] = [];

  const generalQueries = buildGeneralQueries(market, subtopics);
  const userDomains = enabledSources
    .map((s) => domainFromWebsite(s.url))
    .filter((d): d is string => !!d);
  // For pt-BR markets, restrict general search to BR news domains unless user
  // provided their own list. This avoids Tavily surfacing international English
  // press for Portuguese queries about Brazilian subjects.
  const generalDomains = userDomains.length > 0
    ? userDomains
    : (isPt ? BR_NEWS_DOMAINS : undefined);

  for (const q of generalQueries) {
    const results = await searchTavily(q, 8, generalDomains, "basic", 14);
    generalBuckets.push(results);
  }

  // RSS feeds from configured sources
  const rssSources = enabledSources.filter((s) => s.source_type === "rss");
  for (const s of rssSources) {
    const items = await fetchRssFeed(s.url, s.name);
    generalBuckets.push(items);
  }

  const generalRaw = generalBuckets.flat();

  // ── 2. Competitor-specific queries
  const competitorBuckets: { competitorId: string; results: RawArticle[] }[] = [];
  for (const c of enabledCompetitors) {
    const q = competitorQuery(market, c, subtopics);
    const results = await searchTavily(q, 5, generalDomains, "basic", 30);
    competitorBuckets.push({ competitorId: c.id, results });
  }

  // ── 3. Merge with dedup by normalized URL. Prefer competitor-origin rows when duplicate.
  const byUrl = new Map<string, CollectedArticle>();

  function upsert(article: RawArticle, foundVia: "general" | "competitor", primaryCompetitorId?: string) {
    const normalized = normalizeUrl(article.url);
    const existing = byUrl.get(normalized);
    const mentions = new Set(findMentions(article, competitorRefs));
    if (primaryCompetitorId) mentions.add(primaryCompetitorId);

    if (existing) {
      for (const id of mentions) {
        if (!existing.mentioned_competitor_ids.includes(id)) {
          existing.mentioned_competitor_ids.push(id);
        }
      }
      if (foundVia === "competitor") existing.found_via = "competitor";
      return;
    }

    // Language gate: in pt-BR markets skip pure-English titles
    if (isPt && !looksPortuguese(`${article.title} ${article.content || ""}`)) return;

    byUrl.set(normalized, {
      title: article.title,
      source_name: article.source_name || "Desconhecido",
      source_url: normalized,
      summary: article.content || null,
      image_url: article.image_url || null,
      published_at: article.published_at || null,
      relevance_score: 0,
      mentioned_competitor_ids: [...mentions],
      found_via: foundVia,
    });
  }

  // Filter globally first (URL/title dedup + excludes empty)
  const filteredGeneral = filterArticles(generalRaw, []);
  for (const a of filteredGeneral) upsert(a, "general");

  for (const bucket of competitorBuckets) {
    const filtered = filterArticles(bucket.results, []);
    for (const a of filtered) upsert(a, "competitor", bucket.competitorId);
  }

  // ── 4. Score: mentions give +3 each, cap at 10. Recency bonus up to +2.
  const now = Date.now();
  for (const art of byUrl.values()) {
    const mentionsBoost = Math.min(6, art.mentioned_competitor_ids.length * 3);
    const viaBoost = art.found_via === "competitor" ? 2 : 0;
    let recencyBoost = 0;
    if (art.published_at) {
      const ageDays = (now - new Date(art.published_at).getTime()) / 86_400_000;
      if (ageDays >= 0 && ageDays <= 2) recencyBoost = 2;
      else if (ageDays <= 7) recencyBoost = 1;
    }
    art.relevance_score = Math.min(10, 2 + mentionsBoost + viaBoost + recencyBoost);
  }

  return [...byUrl.values()].sort((a, b) => b.relevance_score - a.relevance_score);
}
