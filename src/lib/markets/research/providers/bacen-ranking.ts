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
    const q = `${competitor.name} ranking reclamações BACEN trimestre`;
    const results = await searchTavily(q, 6, ["bcb.gov.br", "bacen.gov.br"], "basic", 540);
    if (results.length === 0) return null;
    const lines = results.map((r) => `• ${r.title}\n  ${r.content.slice(0, 300)}\n  ${r.url}`);
    return { providerId: this.id, label: "BACEN — Ranking de Reclamações", text: lines.join("\n") };
  },
};
