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

    // Build a disambiguating suffix: include the website host and one alias
    // so generic names like "Stone", "Bee" don't drift into unrelated hits.
    let host: string | null = null;
    if (competitor.website) {
      try {
        host = new URL(competitor.website.startsWith("http") ? competitor.website : `https://${competitor.website}`).hostname.replace(/^www\./, "");
      } catch {}
    }
    const primaryAlias = competitor.aliases.find((a) => a.length >= 3) || null;
    const disambig = [host, primaryAlias].filter(Boolean).join(" ");
    const qualifier = disambig ? ` (${disambig})` : "";

    const queries = [
      mk(`${competitor.name}${qualifier} ${market.name} histórico produtos receita`),
      mk(`${competitor.name}${qualifier} CEO diretoria executiva presidente`),
      mk(`${competitor.name}${qualifier} vs concorrentes diferencial posicionamento`),
      mk(`${competitor.name}${qualifier} ações ticker bolsa B3 resultado trimestre`),
      mk(`${competitor.name}${qualifier} administração diretoria conselho`, [
        "cvm.gov.br", "b3.com.br", "br.investing.com", "economatica.com", "valor.globo.com", "infomoney.com.br",
      ]),
    ];
    if (host) {
      queries.push(mk(`${competitor.name} sobre institucional`, [host]));
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
