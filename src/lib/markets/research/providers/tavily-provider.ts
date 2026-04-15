import { searchTavily } from "@/lib/sources/search";
import type { ResearchProvider } from "../types";

export const tavilyCoreProvider: ResearchProvider = {
  id: "tavily-core",
  label: "Busca web (Tavily)",
  description: "Multi-query Tavily em fontes gerais e de mercado.",
  searchLike: true,
  enabled: () => !!process.env.TAVILY_API_KEY,
  async fetch(competitor, market) {
    const mk = (query: string, domains?: string[]) =>
      searchTavily(query, 5, domains, "basic", 60).then((results) => ({
        query,
        results: results.map((r) => ({ title: r.title, url: r.url, content: r.content.slice(0, 300) })),
      }));

    const queries = [
      mk(`${competitor.name} ${market.name} histórico produtos receita`),
      mk(`${competitor.name} CEO diretoria executiva presidente`),
      mk(`${competitor.name} vs concorrentes diferencial posicionamento`),
      mk(`${competitor.name} ações ticker bolsa B3 resultado trimestre`),
      mk(`${competitor.name} administração diretoria conselho`, [
        "cvm.gov.br", "b3.com.br", "br.investing.com", "economatica.com", "valor.globo.com", "infomoney.com.br",
      ]),
    ];
    if (competitor.website) {
      try {
        const host = new URL(competitor.website.startsWith("http") ? competitor.website : `https://${competitor.website}`).hostname.replace(/^www\./, "");
        queries.push(mk(`${competitor.name} sobre institucional`, [host]));
      } catch {}
    }

    const buckets = await Promise.allSettled(queries);
    const blocks: string[] = [];
    for (const r of buckets) {
      if (r.status !== "fulfilled") continue;
      blocks.push(`--- Busca: ${r.value.query} ---`);
      for (const item of r.value.results) {
        blocks.push(`• ${item.title}\n  ${item.content}\n  ${item.url}`);
      }
    }
    if (blocks.length === 0) return null;
    return {
      providerId: this.id,
      label: "Pesquisa web (Tavily)",
      text: blocks.join("\n"),
    };
  },
};
