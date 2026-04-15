import Parser from "rss-parser";
import type { ResearchProvider } from "../types";

const parser = new Parser({ timeout: 8000, headers: { "User-Agent": "JNews/1.0" } });

export const googleNewsRssProvider: ResearchProvider = {
  id: "google-news-rss",
  label: "Google News RSS",
  description: "Notícias recentes via feed público do Google News.",
  searchLike: true,
  enabled: () => true,
  async fetch(competitor, market) {
    const lang = market.language === "pt-BR" ? "pt-BR" : "en";
    const country = market.language === "pt-BR" ? "BR" : "US";
    const query = `${competitor.name} ${market.name}`.trim();
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${lang}&gl=${country}&ceid=${country}:${lang.split("-")[0]}`;
    try {
      const feed = await parser.parseURL(url);
      const items = (feed.items || []).slice(0, 12);
      if (items.length === 0) return null;
      const lines = items.map((it) => {
        const date = it.isoDate ? ` · ${it.isoDate.slice(0, 10)}` : "";
        const source = typeof it.source === "string" ? it.source : (it.source as { _?: string } | undefined)?._ ?? "";
        return `• [${source}${date}] ${it.title}\n  ${it.link}`;
      });
      return {
        providerId: this.id,
        label: "Google News RSS",
        text: lines.join("\n"),
      };
    } catch {
      return null;
    }
  },
};
