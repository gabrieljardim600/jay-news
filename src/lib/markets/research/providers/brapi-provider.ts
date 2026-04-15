import { lookupPublicCompany, formatBrapiForPrompt } from "../brapi";
import type { ResearchProvider } from "../types";

export const brapiProvider: ResearchProvider = {
  id: "brapi",
  label: "B3 / brapi.dev",
  description: "Ticker, setor, valor de mercado, funcionários (empresas listadas B3).",
  enabled: (_c, m) => m.language === "pt-BR",
  async fetch(competitor) {
    try {
      const q = await lookupPublicCompany(competitor.name);
      if (!q) return null;
      return {
        providerId: this.id,
        label: "B3 / BRAPI",
        text: formatBrapiForPrompt(q),
        hints: {
          ticker: `${q.ticker} - B3`,
          ...(q.logoUrl ? { logo_url: q.logoUrl } : {}),
        },
      };
    } catch {
      return null;
    }
  },
};
