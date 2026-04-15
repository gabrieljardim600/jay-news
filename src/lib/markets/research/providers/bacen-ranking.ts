import { searchTavily } from "@/lib/sources/search";
import type { ResearchProvider } from "../types";

/** Ranking trimestral de reclamações do BACEN — dado oficial muito mais
 *  relevante que Reclame Aqui para IFs / IPs reguladas. */
export const bacenRankingProvider: ResearchProvider = {
  id: "bacen-ranking",
  label: "BACEN — Ranking de Reclamações",
  description: "Reclamações formais recebidas pelo BACEN por trimestre.",
  searchLike: true,
  enabled: (_c, m) => m.language === "pt-BR" && !!process.env.TAVILY_API_KEY,
  async fetch(competitor) {
    const queries = [
      `${competitor.name} ranking reclamações trimestral`,
      `${competitor.name} BACEN reclamações clientes`,
      `${competitor.name} IF.data reclamações`,
    ];
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const q of queries) {
      try {
        const res = await searchTavily(q, 5, ["bcb.gov.br", "bacen.gov.br"], "basic", 540);
        for (const r of res) {
          if (seen.has(r.url)) continue;
          seen.add(r.url);
          lines.push(`• ${r.title}\n  ${r.content.slice(0, 280)}\n  ${r.url}`);
        }
      } catch {}
    }
    if (lines.length === 0) return null;
    return { providerId: this.id, label: "BACEN — Ranking de Reclamações", text: lines.join("\n") };
  },
};
