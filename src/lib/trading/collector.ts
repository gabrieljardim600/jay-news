import { searchTavily } from "@/lib/sources/search";
import { fetchAllRssFeeds } from "@/lib/sources/rss";
import type { TradingEdition, AgendaEvent } from "./types";
import {
  MORNING_QUERIES, CLOSING_QUERIES, FINANCIAL_RSS,
  HIGH_IMPACT_EVENTS, SENTIMENT_CONFIG,
} from "./sources";

type MarketBucket = {
  label: string;
  global: boolean;
  results: Array<{ title: string; content: string; url: string }>;
};

type Headline = {
  title: string;
  url: string;
  source_name: string;
  published_at?: string;
};

export type CollectedTradingData = {
  marketBuckets: MarketBucket[];
  headlines: Headline[];
  agenda: AgendaEvent[];
  sentiment: {
    fear_greed: number | null;
    fear_greed_label: string | null;
    vix: number | null;
    put_call: number | null;
  };
};

async function fetchMarketData(edition: TradingEdition): Promise<MarketBucket[]> {
  const queries = edition === "morning" ? MORNING_QUERIES : CLOSING_QUERIES;
  const results = await Promise.allSettled(
    queries.map(async (q) => {
      const r = await searchTavily(q.query, 4, undefined, "basic", 2);
      return {
        label: q.label,
        global: q.global,
        results: r.map((a) => ({ title: a.title, content: a.content.slice(0, 300), url: a.url })),
      };
    }),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<MarketBucket> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((b) => b.results.length > 0);
}

async function fetchFinancialNews(): Promise<Headline[]> {
  try {
    const articles = await fetchAllRssFeeds(FINANCIAL_RSS.map((f) => ({ url: f.url, name: f.name })));
    return articles.slice(0, 30).map((a) => ({
      title: a.title,
      url: a.url,
      source_name: a.source_name,
      published_at: a.published_at,
    }));
  } catch {
    return [];
  }
}

async function fetchAgenda(): Promise<AgendaEvent[]> {
  if (!process.env.TAVILY_API_KEY) return [];
  try {
    const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const results = await searchTavily(
      `agenda econômica hoje ${today} calendário econômico`, 8,
      ["br.investing.com", "infomoney.com.br", "bcb.gov.br", "valor.globo.com"], "basic", 2,
    );
    const blob = results.map((r) => `${r.title} ${r.content}`).join(" ").toLowerCase();
    const matched: AgendaEvent[] = [];
    for (const ev of HIGH_IMPACT_EVENTS) {
      if (ev.keywords.some((kw) => blob.includes(kw.toLowerCase()))) {
        matched.push({ time: "—", event: ev.event, impact: ev.impact, region: ev.region });
      }
    }
    return matched;
  } catch {
    return [];
  }
}

async function fetchSentiment(): Promise<CollectedTradingData["sentiment"]> {
  const out: CollectedTradingData["sentiment"] = {
    fear_greed: null, fear_greed_label: null, vix: null, put_call: null,
  };

  // CNN Fear & Greed — primary: direct API, fallback: Tavily scrape
  try {
    const r = await fetch(SENTIMENT_CONFIG.fear_greed_url, {
      signal: AbortSignal.timeout(5_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JNews/1.0)" },
    });
    if (r.ok) {
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("json")) {
        const data = (await r.json()) as { fear_and_greed?: { score?: number; rating?: string } };
        if (data.fear_and_greed) {
          out.fear_greed = typeof data.fear_and_greed.score === "number" ? Math.round(data.fear_and_greed.score) : null;
          out.fear_greed_label = data.fear_and_greed.rating ?? null;
        }
      }
    }
  } catch {}
  // Fallback: Tavily
  if (out.fear_greed == null && process.env.TAVILY_API_KEY) {
    try {
      const r = await searchTavily("CNN Fear and Greed Index value today", 3, undefined, "basic", 2);
      for (const item of r) {
        const m = item.content.match(/(?:fear\s*(?:&|and)\s*greed|index)[^\d]*(\d{1,3})/i);
        if (m) {
          const v = parseInt(m[1]);
          if (v >= 0 && v <= 100) {
            out.fear_greed = v;
            if (v <= 25) out.fear_greed_label = "Extreme Fear";
            else if (v <= 45) out.fear_greed_label = "Fear";
            else if (v <= 55) out.fear_greed_label = "Neutral";
            else if (v <= 75) out.fear_greed_label = "Greed";
            else out.fear_greed_label = "Extreme Greed";
            break;
          }
        }
      }
    } catch {}
  }

  // VIX via Tavily
  if (process.env.TAVILY_API_KEY) {
    try {
      const r = await searchTavily(SENTIMENT_CONFIG.vix_query, 3, undefined, "basic", 2);
      for (const item of r) {
        const m = item.content.match(/(?:VIX|vix)[^\d]*(\d{1,3}(?:\.\d{1,2})?)/);
        if (m) { out.vix = parseFloat(m[1]); break; }
      }
    } catch {}
  }

  // Put/Call via Tavily
  if (process.env.TAVILY_API_KEY) {
    try {
      const r = await searchTavily(SENTIMENT_CONFIG.put_call_query, 3, undefined, "basic", 2);
      for (const item of r) {
        const m = item.content.match(/(?:put.?call|p.?c)[^\d]*(\d\.\d{1,3})/i);
        if (m) { out.put_call = parseFloat(m[1]); break; }
      }
    } catch {}
  }

  return out;
}

export async function collectTradingData(edition: TradingEdition): Promise<CollectedTradingData> {
  const [marketBuckets, headlines, agenda, sentiment] = await Promise.all([
    fetchMarketData(edition),
    fetchFinancialNews(),
    fetchAgenda(),
    fetchSentiment(),
  ]);
  return { marketBuckets, headlines, agenda, sentiment };
}
