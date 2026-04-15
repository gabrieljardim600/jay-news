import { searchTavily } from "@/lib/sources/search";
import type { ResearchProvider } from "../types";

const COMPARISON_DOMAINS = [
  "melhormaquininha.com.br",
  "celero.io",
  "trocandoideia.com",
  "serasaexperian.com.br",
  "startse.com",
  "ecommercenews.com.br",
  "ecommercebrasil.com.br",
  "valor.globo.com",
  "infomoney.com.br",
  "brazilian-journal.com",
  "neofeed.com.br",
  "ejuntos.com.br",
  "reclameaqui.com.br",
  "consumidormoderno.com.br",
  "mundodomarketing.com.br",
];

/** Portais de comparação e imprensa setorial — reviews comerciais,
 *  comparativos de MDR, antecipação, aluguel de POS. */
export const comparisonSitesProvider: ResearchProvider = {
  id: "comparison-sites",
  label: "Comparativos comerciais",
  description: "Portais BR comparando taxas, MDR, produtos e planos.",
  searchLike: true,
  enabled: () => !!process.env.TAVILY_API_KEY,
  async fetch(competitor) {
    const queries = [
      `${competitor.name} taxas MDR comparativo`,
      `${competitor.name} aluguel maquininha preço plano`,
      `${competitor.name} antecipação recebíveis taxa`,
      `${competitor.name} vs Stone vs Cielo vs PagBank`,
    ];
    const out: string[] = [];
    for (const q of queries) {
      try {
        const res = await searchTavily(q, 4, COMPARISON_DOMAINS, "basic", 540);
        for (const r of res) {
          out.push(`• ${r.title}\n  ${r.content.slice(0, 280)}\n  ${r.url}`);
        }
      } catch {}
    }
    if (out.length === 0) return null;
    return { providerId: this.id, label: "Comparativos & imprensa comercial", text: out.join("\n") };
  },
};
