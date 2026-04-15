import { searchTavily } from "@/lib/sources/search";
import type { ResearchProvider } from "../types";

/** Factory para providers que batem em 1 domínio específico via Tavily.
 *  Quando não há API pública estável mas o site tem conteúdo indexado,
 *  é o caminho de menor fricção. Cada provider filtra por include_domains
 *  e devolve os 5 primeiros hits. */
function tavilyOnDomain(params: {
  id: string;
  label: string;
  description: string;
  domains: string[];
  queryFactory: (name: string) => string;
  days?: number;
  enabled?: ResearchProvider["enabled"];
}): ResearchProvider {
  return {
    id: params.id,
    label: params.label,
    description: params.description,
    enabled: params.enabled ?? (() => !!process.env.TAVILY_API_KEY),
    async fetch(competitor) {
      const q = params.queryFactory(competitor.name);
      const results = await searchTavily(q, 6, params.domains, "basic", params.days ?? 365);
      if (results.length === 0) return null;
      const lines = results.map((r) => `• ${r.title}\n  ${r.content.slice(0, 260)}\n  ${r.url}`);
      return { providerId: this.id, label: params.label, text: lines.join("\n") };
    },
  };
}

export const consumidorGovProvider = tavilyOnDomain({
  id: "consumidor-gov",
  label: "consumidor.gov.br",
  description: "Reclamações oficiais via Procon indexadas pela plataforma federal.",
  domains: ["consumidor.gov.br"],
  queryFactory: (n) => `${n} reclamação`,
});

export const jusBrasilProvider = tavilyOnDomain({
  id: "jusbrasil",
  label: "JusBrasil",
  description: "Processos e jurisprudência citando a empresa (busca pública).",
  domains: ["jusbrasil.com.br"],
  queryFactory: (n) => `${n}`,
});

export const douProvider = tavilyOnDomain({
  id: "dou",
  label: "Diário Oficial da União",
  description: "Publicações oficiais — sanções, multas, autorizações regulatórias.",
  domains: ["in.gov.br", "imprensanacional.gov.br"],
  queryFactory: (n) => `${n}`,
});

export const proconSpProvider = tavilyOnDomain({
  id: "procon-sp",
  label: "Procon-SP",
  description: "Rankings, autuações e reclamações via Procon-SP.",
  domains: ["procon.sp.gov.br"],
  queryFactory: (n) => `${n}`,
});

export const crunchbaseBasicProvider = tavilyOnDomain({
  id: "crunchbase-basic",
  label: "Crunchbase (perfil público)",
  description: "Resumo público — fundação, investidores, rodadas citadas.",
  domains: ["crunchbase.com"],
  queryFactory: (n) => `${n}`,
});

export const tracxnProvider = tavilyOnDomain({
  id: "tracxn",
  label: "Tracxn (básico)",
  description: "Perfil público no Tracxn.",
  domains: ["tracxn.com"],
  queryFactory: (n) => `${n}`,
});

export const startupBaseProvider = tavilyOnDomain({
  id: "startupbase",
  label: "StartupBase (ABStartups)",
  description: "Database BR de startups — perfil, estágio, investidores.",
  domains: ["startupbase.com.br"],
  queryFactory: (n) => `${n}`,
});

export const linkedinPublicProvider = tavilyOnDomain({
  id: "linkedin-public",
  label: "LinkedIn (perfis públicos)",
  description: "Páginas de empresa e perfis de executivos citados (busca pública).",
  domains: ["linkedin.com"],
  queryFactory: (n) => `${n} CEO OR diretor OR presidente`,
});

export const tiktokCreativeProvider = tavilyOnDomain({
  id: "tiktok-creative",
  label: "TikTok Creative Center",
  description: "Anúncios e conteúdos em alta citando a marca.",
  domains: ["ads.tiktok.com", "tiktok.com"],
  queryFactory: (n) => `${n} anúncio`,
});

export const glassdoorProvider = tavilyOnDomain({
  id: "glassdoor",
  label: "Glassdoor",
  description: "Nota de empregado, cultura, salários médios (scrape via busca).",
  domains: ["glassdoor.com", "glassdoor.com.br"],
  queryFactory: (n) => `${n} reviews empregado`,
});
