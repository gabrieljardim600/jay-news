import { searchTavily } from "@/lib/sources/search";
import type { ResearchProvider } from "../types";

/** Reviews/unboxings/comparativos no YouTube e em mídias de produto.
 *  Captura voz de vendedor/cliente comentando a experiência de uso. */
export const productReviewsProvider: ResearchProvider = {
  id: "product-reviews",
  label: "Reviews & unboxings",
  description: "Vídeos e posts de experiência de uso e comparação de produtos.",
  searchLike: true,
  enabled: () => !!process.env.TAVILY_API_KEY,
  async fetch(competitor) {
    const queries = [
      `${competitor.name} review unboxing maquininha`,
      `${competitor.name} como usar funcionalidades`,
      `${competitor.name} vale a pena experiência`,
    ];
    const out: string[] = [];
    for (const q of queries) {
      try {
        const res = await searchTavily(q, 4, ["youtube.com", "youtu.be", "medium.com", "tecmundo.com.br", "canaltech.com.br", "olhardigital.com.br"], "basic", 540);
        for (const r of res) {
          out.push(`• ${r.title}\n  ${r.content.slice(0, 260)}\n  ${r.url}`);
        }
      } catch {}
    }
    if (out.length === 0) return null;
    return { providerId: this.id, label: "Reviews comerciais & unboxings", text: out.join("\n") };
  },
};
