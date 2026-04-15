import { searchTavily } from "@/lib/sources/search";
import type { ResearchProvider } from "../types";

/** CVM — ITR/DFP (demonstrações trimestrais) + dados abertos. Complementa o
 *  cvm-fre com granularidade de receita por linha de negócio. */
export const cvmItrProvider: ResearchProvider = {
  id: "cvm-itr",
  label: "CVM — ITR / DFP",
  description: "Demonstrações trimestrais (ITR) e anuais (DFP) via portal CVM.",
  searchLike: true,
  enabled: (_c, m) => m.language === "pt-BR" && !!process.env.TAVILY_API_KEY,
  async fetch(competitor) {
    const results = await searchTavily(
      `${competitor.name} ITR DFP receita lucro trimestre`,
      6,
      ["cvm.gov.br", "dados.cvm.gov.br", "rad.cvm.gov.br", "sistemas.cvm.gov.br"],
      "basic",
      540,
    );
    if (results.length === 0) return null;
    const lines = results.map((r) => `• ${r.title}\n  ${r.content.slice(0, 300)}\n  ${r.url}`);
    return { providerId: this.id, label: "CVM — ITR / DFP", text: lines.join("\n") };
  },
};
