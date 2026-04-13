import { NextResponse } from "next/server";
import { fetchRssFeed } from "@/lib/sources/rss";
import { searchTavily } from "@/lib/sources/search";

const RSS_FEEDS = [
  { name: "InfoMoney", url: "https://www.infomoney.com.br/feed/" },
  { name: "Investing.com BR", url: "https://br.investing.com/rss/news_1.rss" },
  { name: "Exame", url: "https://exame.com/feed/" },
  { name: "Canaltech", url: "https://canaltech.com.br/rss/" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { name: "Reuters Business", url: "https://feeds.reuters.com/reuters/businessNews" },
  { name: "UOL Economia", url: "https://rss.uol.com.br/feed/economia.xml" },
];

const TAVILY_QUERIES = [
  { name: "The News (domain)", query: "noticias tecnologia negocios", includeDomains: ["thenewscc.beehiiv.com"] },
  { name: "IA Brasil", query: "inteligência artificial IA noticias Brasil" },
  { name: "Day Trade Brasil", query: "day trade mini índice mini dólar Brasil noticias" },
  { name: "Torneios Trading", query: "torneio de trading Brasil campeonato trader" },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rssResults: Record<string, { count: number; error?: string; sample: string[] }> = {};
  const tavilyResults: Record<string, { count: number; error?: string; sample: string[] }> = {};

  // Test each RSS feed
  for (const feed of RSS_FEEDS) {
    try {
      const articles = await fetchRssFeed(feed.url, feed.name);
      rssResults[feed.name] = {
        count: articles.length,
        sample: articles.slice(0, 3).map((a) => a.title),
      };
    } catch (e) {
      rssResults[feed.name] = { count: 0, error: String(e), sample: [] };
    }
  }

  // Test Tavily directly with raw fetch to see status
  const tavilyKey = process.env.TAVILY_API_KEY;
  const tavilyRawTest = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tavilyKey}` },
    body: JSON.stringify({ query: "test", max_results: 1, search_depth: "basic" }),
  });
  const tavilyRawStatus = tavilyRawTest.status;
  const tavilyRawBody = await tavilyRawTest.text().catch(() => "");

  // Test Tavily queries
  for (const q of TAVILY_QUERIES) {
    try {
      const articles = await searchTavily(q.query, 5, q.includeDomains);
      tavilyResults[q.name] = {
        count: articles.length,
        sample: articles.slice(0, 3).map((a) => `[${a.source_name}] ${a.title}`),
      };
    } catch (e) {
      tavilyResults[q.name] = { count: 0, error: String(e), sample: [] };
    }
  }

  return NextResponse.json({
    rss: rssResults,
    tavily: tavilyResults,
    tavily_raw_test: { status: tavilyRawStatus, body: tavilyRawBody.slice(0, 300) },
  });
}
