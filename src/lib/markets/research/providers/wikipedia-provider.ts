import { fetchWikipediaSummary, fetchWikipediaExtract } from "../wikipedia";
import type { ResearchProvider } from "../types";

export const wikipediaProvider: ResearchProvider = {
  id: "wikipedia",
  label: "Wikipedia (PT-BR)",
  description: "Resumo institucional e thumbnail da verbete PT.",
  enabled: () => true,
  async fetch(competitor) {
    try {
      const [summary, extract] = await Promise.all([
        fetchWikipediaSummary(competitor.name),
        fetchWikipediaExtract(competitor.name, 3500),
      ]);
      if (!summary && !extract) return null;
      const lines: string[] = [];
      if (summary) {
        lines.push(`Título: ${summary.title}${summary.description ? ` (${summary.description})` : ""}`);
        lines.push(`URL: ${summary.url}`);
      }
      if (extract) lines.push("", extract);
      return {
        providerId: this.id,
        label: "Wikipedia PT-BR",
        text: lines.join("\n"),
        hints: summary?.originalImage ? { logo_url: summary.originalImage } : undefined,
      };
    } catch {
      return null;
    }
  },
};
