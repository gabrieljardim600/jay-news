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

/* ────────────────────────────────────────────────────────── */
/* Novos targeted providers                                    */
/* ────────────────────────────────────────────────────────── */

export const productHuntProvider = tavilyOnDomain({
  id: "producthunt",
  label: "Product Hunt",
  description: "Lançamentos e upvotes — radar de concorrentes globais.",
  domains: ["producthunt.com"],
  queryFactory: (n) => `${n}`,
});

export const googleAdsTransparencyProvider = tavilyOnDomain({
  id: "google-ads-transparency",
  label: "Google Ads Transparency Center",
  description: "Anúncios ativos do advertiser no Search, YouTube e Display.",
  domains: ["adstransparency.google.com"],
  queryFactory: (n) => `${n}`,
});

export const linkedinAdLibraryProvider = tavilyOnDomain({
  id: "linkedin-ad-library",
  label: "LinkedIn Ad Library",
  description: "Campanhas ativas B2B na plataforma LinkedIn.",
  domains: ["linkedin.com"],
  queryFactory: (n) => `${n} ad library anúncios`,
});

export const anatelHomologacaoProvider = tavilyOnDomain({
  id: "anatel-homologacao",
  label: "ANATEL — Homologação",
  description: "Terminais, maquininhas e hardware homologados (sch.anatel.gov.br).",
  domains: ["sch.anatel.gov.br", "sistemas.anatel.gov.br", "anatel.gov.br"],
  queryFactory: (n) => `${n} homologação terminal`,
});

export const jucespProvider = tavilyOnDomain({
  id: "jucesp",
  label: "Juntas Comerciais (Jucesp e outras)",
  description: "Alterações societárias e capital registradas nas juntas estaduais.",
  domains: ["jucesp.sp.gov.br", "jucesp.fazenda.sp.gov.br", "jucerja.rj.gov.br", "jucemg.mg.gov.br"],
  queryFactory: (n) => `${n}`,
});

export const cvmRiProvider = tavilyOnDomain({
  id: "cvm-ri",
  label: "CVM / RI — fatos e apresentações",
  description: "Fatos relevantes, ITR, apresentações trimestrais (lista novos produtos).",
  domains: ["rad.cvm.gov.br", "cvm.gov.br", "mzweb.com.br", "riweb.com.br", "mziq.com"],
  queryFactory: (n) => `${n} fato relevante OR apresentação trimestral`,
  days: 180,
});

export const googleTrendsProvider = tavilyOnDomain({
  id: "google-trends",
  label: "Google Trends",
  description: "Termos relacionados e interesse ao longo do tempo para a marca.",
  domains: ["trends.google.com", "trends.google.com.br"],
  queryFactory: (n) => `${n}`,
});

export const appFollowProvider = tavilyOnDomain({
  id: "appfollow",
  label: "AppFollow",
  description: "Changelog por versão, ASO e analytics de apps móveis.",
  domains: ["appfollow.io"],
  queryFactory: (n) => `${n} app`,
});

export const sensorTowerProvider = tavilyOnDomain({
  id: "sensor-tower",
  label: "Sensor Tower",
  description: "Downloads, receita estimada e inteligência de apps móveis.",
  domains: ["sensortower.com"],
  queryFactory: (n) => `${n}`,
});

export const dataAiProvider = tavilyOnDomain({
  id: "data-ai",
  label: "data.ai (App Annie)",
  description: "Ranking histórico, performance e inteligência de apps.",
  domains: ["data.ai", "appannie.com"],
  queryFactory: (n) => `${n}`,
});
