import { searchTavily } from "@/lib/sources/search";
import type { ResearchProvider } from "../types";

/**
 * CVM publica o Formulário de Referência em https://dados.cvm.gov.br,
 * distribuído em CSVs pesados. Parse direto não cabe no orçamento de tempo
 * do briefing. Estratégia prática: usamos Tavily focado em domínios da CVM,
 * B3 e imprensa especializada para extrair composição oficial da diretoria,
 * que é o campo de maior valor. Quando houver necessidade real de parsing,
 * este provider evolui para baixar/cache do CSV com filtro por CNPJ.
 */
export const cvmFreProvider: ResearchProvider = {
  id: "cvm-fre",
  label: "CVM — Formulário de Referência",
  description: "Composição oficial de diretoria/conselho (empresas listadas na B3).",
  enabled: (_c, m) => m.language === "pt-BR" && !!process.env.TAVILY_API_KEY,
  async fetch(competitor) {
    const results = await searchTavily(
      `${competitor.name} formulário de referência FRE diretoria conselho`,
      8,
      ["cvm.gov.br", "rad.cvm.gov.br", "b3.com.br", "ri."],
      "advanced",
      365,
    );
    if (results.length === 0) return null;
    const lines = results.map((r) => `• ${r.title}\n  ${r.content.slice(0, 300)}\n  ${r.url}`);
    return {
      providerId: this.id,
      label: "CVM — Formulário de Referência",
      text: lines.join("\n"),
    };
  },
};
