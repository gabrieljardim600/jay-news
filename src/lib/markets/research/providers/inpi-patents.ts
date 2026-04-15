import { searchTavily } from "@/lib/sources/search";
import type { ResearchProvider } from "../types";

/** INPI (BR) não tem API pública JSON estável. Usamos Tavily filtrando para
 * busca.inpi.gov.br e Google Patents como fallback. */
export const patentsProvider: ResearchProvider = {
  id: "patents",
  label: "Patentes (INPI + Google Patents)",
  description: "Patentes registradas no Brasil (INPI) e globais (Google Patents).",
  enabled: () => !!process.env.TAVILY_API_KEY,
  async fetch(competitor) {
    const results = await Promise.allSettled([
      searchTavily(`patente ${competitor.name}`, 5, ["busca.inpi.gov.br", "inpi.gov.br"], "basic", 365),
      searchTavily(`${competitor.name} patent`, 5, ["patents.google.com"], "basic", 365),
    ]);
    const lines: string[] = [];
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const item of r.value) {
        lines.push(`• ${item.title}\n  ${item.content.slice(0, 200)}\n  ${item.url}`);
      }
    }
    if (lines.length === 0) return null;
    return { providerId: this.id, label: "Patentes INPI + Google Patents", text: lines.join("\n") };
  },
};
