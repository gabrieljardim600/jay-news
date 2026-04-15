/**
 * Scaffolded providers — arquitetura + metadata prontas, mas o fetch
 * ainda retorna null. Cada stub documenta a estratégia planejada e, se
 * aplicável, a env var que destrava a implementação real.
 *
 * Estes providers aparecem na UI de seleção de módulos, mas só contribuem
 * depois de implementados. Fetch retornando null é inócuo para o briefing.
 */
import type { ResearchProvider } from "../types";

function stub(id: string, label: string, description: string, enabledFn?: ResearchProvider["enabled"]): ResearchProvider {
  return {
    id,
    label,
    description,
    enabled: enabledFn ?? (() => false),
    async fetch() { return null; },
  };
}

// Marketing / Ads ────────────────────────────────────────────────────────────
export const metaAdLibraryProvider = stub(
  "meta-ad-library",
  "Meta Ad Library",
  "Anúncios ativos no Facebook/Instagram. Requer META_AD_LIBRARY_TOKEN (Graph API).",
  () => !!process.env.META_AD_LIBRARY_TOKEN,
);

export const tiktokCreativeProvider = stub(
  "tiktok-creative",
  "TikTok Creative Center",
  "Anúncios TikTok — scraping público do Creative Center (sem API).",
);

// Reputação ──────────────────────────────────────────────────────────────────
export const consumidorGovProvider = stub(
  "consumidor-gov",
  "consumidor.gov.br",
  "Reclamações Procon — scraping da busca pública.",
);

export const googleMapsReviewsProvider = stub(
  "google-maps",
  "Google Maps reviews",
  "Nota e volume em filiais/sede. Requer GOOGLE_PLACES_API_KEY.",
  () => !!process.env.GOOGLE_PLACES_API_KEY,
);

export const trustpilotProvider = stub(
  "trustpilot",
  "Trustpilot",
  "Rating + volume — scraping da página pública.",
);

export const glassdoorProvider = stub(
  "glassdoor",
  "Glassdoor",
  "Nota de empregado, cultura, salários médios — scraping público.",
);

// Jurídico ───────────────────────────────────────────────────────────────────
export const jusBrasilProvider = stub(
  "jusbrasil",
  "JusBrasil (busca pública)",
  "Processos citando a empresa — scraping da busca pública.",
);

export const escavadorProvider = stub(
  "escavador",
  "Escavador (freemium)",
  "Processos por CNPJ. Requer ESCAVADOR_TOKEN.",
  () => !!process.env.ESCAVADOR_TOKEN,
);

export const douProvider = stub(
  "dou",
  "Diário Oficial da União",
  "Sanções, multas, autorizações — InlabsDOU ou scraping IN.gov.br.",
);

export const proconSpProvider = stub(
  "procon-sp",
  "Procon-SP",
  "Rankings de empresas mais reclamadas — scraping.",
);

// Funding ────────────────────────────────────────────────────────────────────
export const crunchbaseBasicProvider = stub(
  "crunchbase-basic",
  "Crunchbase (perfil público)",
  "Fundação, investidores públicos — scraping da página pública.",
);

export const tracxnProvider = stub(
  "tracxn",
  "Tracxn (básico)",
  "Perfil público — scraping.",
);

export const startupBaseProvider = stub(
  "startupbase",
  "StartupBase (ABStartups)",
  "Database BR — scraping.",
);

// Infra / segurança ──────────────────────────────────────────────────────────
export const shodanProvider = stub(
  "shodan",
  "Shodan",
  "Serviços expostos por domínio. Requer SHODAN_API_KEY.",
  () => !!process.env.SHODAN_API_KEY,
);

export const securityTrailsProvider = stub(
  "securitytrails",
  "SecurityTrails",
  "Histórico DNS e subdomínios. Requer SECURITYTRAILS_API_KEY (freemium).",
  () => !!process.env.SECURITYTRAILS_API_KEY,
);

// Liderança avançada ─────────────────────────────────────────────────────────
export const linkedinPublicProvider = stub(
  "linkedin-public",
  "LinkedIn (perfis públicos)",
  "Scrape cuidadoso dos perfis públicos citados na diretoria. TOS-sensível.",
);

// Mobile / app ───────────────────────────────────────────────────────────────
export const playStoreProvider = stub(
  "play-store",
  "Google Play Store",
  "Rating + reviews + changelog — scraping do listing do app.",
);

export const appStoreProvider = stub(
  "app-store",
  "App Store (Apple)",
  "Rating + reviews + changelog — iTunes RPC pública.",
);
