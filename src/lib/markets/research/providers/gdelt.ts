import type { ResearchProvider } from "../types";

type GdeltArticle = {
  title: string;
  url: string;
  seendate: string;
  domain: string;
  sourcecountry: string;
  language: string;
};

export const gdeltProvider: ResearchProvider = {
  id: "gdelt",
  label: "GDELT",
  description: "Menções globais em imprensa monitorada pelo GDELT (free).",
  searchLike: true,
  enabled: () => true,
  async fetch(competitor, market) {
    const q = `"${competitor.name}"`;
    const params = new URLSearchParams({
      query: q,
      mode: "artlist",
      maxrecords: "15",
      format: "json",
      timespan: "60d",
      sourcelang: market.language === "pt-BR" ? "por" : "eng",
    });
    try {
      const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const data = (await res.json()) as { articles?: GdeltArticle[] };
      const arts = data.articles?.slice(0, 12) || [];
      if (arts.length === 0) return null;
      const lines = arts.map((a) => `• [${a.domain} · ${a.sourcecountry} · ${a.seendate?.slice(0, 8)}] ${a.title}\n  ${a.url}`);
      return { providerId: this.id, label: "GDELT (60d)", text: lines.join("\n") };
    } catch {
      return null;
    }
  },
};
