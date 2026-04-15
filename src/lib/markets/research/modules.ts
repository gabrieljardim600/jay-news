import type { ResearchModule } from "./types";
import { tavilyCoreProvider } from "./providers/tavily-provider";
import { wikipediaProvider } from "./providers/wikipedia-provider";
import { websiteProvider } from "./providers/website-provider";
import { brapiProvider } from "./providers/brapi-provider";
import { brasilApiCnpjProvider } from "./providers/brasilapi-cnpj";
import { googleNewsRssProvider } from "./providers/google-news-rss";
import { gdeltProvider } from "./providers/gdelt";
import { bacenIfProvider } from "./providers/bacen-if";
import { cvmFreProvider } from "./providers/cvm-fre";
import { patentsProvider } from "./providers/inpi-patents";
import { reclameAquiProvider } from "./providers/reclame-aqui";
import { appStoreProvider } from "./providers/app-store";
import { playStoreProvider } from "./providers/play-store";
import { trustpilotProvider } from "./providers/trustpilot";
import { metaAdLibraryProvider } from "./providers/meta-ad-library";
import { googleMapsReviewsProvider } from "./providers/google-maps";
import { shodanProvider } from "./providers/shodan";
import { securityTrailsProvider } from "./providers/securitytrails";
import {
  consumidorGovProvider, jusBrasilProvider, douProvider, proconSpProvider,
  crunchbaseBasicProvider, tracxnProvider, startupBaseProvider,
  linkedinPublicProvider, tiktokCreativeProvider, glassdoorProvider,
  productHuntProvider, googleAdsTransparencyProvider, linkedinAdLibraryProvider,
  anatelHomologacaoProvider, jucespProvider, cvmRiProvider, googleTrendsProvider,
  appFollowProvider, sensorTowerProvider, dataAiProvider,
} from "./providers/tavily-targeted";
import {
  crtShProvider, hnAlgoliaProvider, redditProvider, waybackCdxProvider,
  sitemapRobotsProvider, portalTransparenciaProvider, youtubeDataProvider,
  pageSpeedProvider, productPathsProvider, minhaReceitaProvider,
} from "./providers/real-extras";
import { bacenRankingProvider } from "./providers/bacen-ranking";
import { datajudCnjProvider } from "./providers/datajud-cnj";
import { builtwithProvider } from "./providers/builtwith";
import { similarwebProvider } from "./providers/similarweb";
import { ecommercePlatformsProvider } from "./providers/ecommerce-platforms";
import { cvmItrProvider } from "./providers/cvm-itr";
import { pricingPagesProvider } from "./providers/pricing-pages";
import { comparisonSitesProvider } from "./providers/comparison-sites";
import { productReviewsProvider } from "./providers/product-reviews";

export const MODULES: ResearchModule[] = [
  {
    id: "core",
    label: "Núcleo",
    description: "Pesquisa web, Wikipedia, site oficial e brapi. Sempre ativo.",
    icon: "Sparkles",
    always_on: true,
    required_fields: ["name"],
    optional_fields: ["website", "ticker"],
    providers: [tavilyCoreProvider, wikipediaProvider, websiteProvider, brapiProvider],
  },
  {
    id: "corporate-registry",
    label: "Registro corporativo",
    description: "BrasilAPI, Receita Federal (minhareceita), BACEN, Juntas Comerciais.",
    icon: "FileText",
    required_fields: ["cnpj"],
    optional_fields: ["name"],
    providers: [brasilApiCnpjProvider, minhaReceitaProvider, bacenIfProvider, jucespProvider],
  },
  {
    id: "financial-public",
    label: "Financeiro (empresa aberta)",
    description: "CVM — FRE, ITR/DFP, Fatos & Apresentações (RI).",
    icon: "TrendingUp",
    required_fields: ["name"],
    optional_fields: ["ticker", "cnpj"],
    providers: [cvmFreProvider, cvmRiProvider, cvmItrProvider],
  },
  {
    id: "gov-contracts",
    label: "Contratos governo",
    description: "Portal da Transparência — contratos federais por CNPJ.",
    icon: "Landmark",
    required_fields: ["cnpj"],
    providers: [portalTransparenciaProvider],
  },
  {
    id: "leadership",
    label: "Liderança & time",
    description: "CVM FRE + LinkedIn (busca pública direcionada).",
    icon: "Users",
    required_fields: ["name"],
    optional_fields: ["cnpj"],
    providers: [cvmFreProvider, linkedinPublicProvider],
  },
  {
    id: "ip",
    label: "Propriedade intelectual",
    description: "Patentes no INPI (BR), Google Patents e homologação ANATEL.",
    icon: "Lightbulb",
    required_fields: ["name"],
    providers: [patentsProvider, anatelHomologacaoProvider],
  },
  {
    id: "paid-marketing",
    label: "Marketing pago",
    description: "Meta, TikTok, Google Ads Transparency e LinkedIn Ad Library.",
    icon: "Megaphone",
    required_fields: ["name"],
    optional_fields: ["website"],
    providers: [metaAdLibraryProvider, tiktokCreativeProvider, googleAdsTransparencyProvider, linkedinAdLibraryProvider],
  },
  {
    id: "mobile",
    label: "Apps mobile",
    description: "Play/App Store + AppFollow, Sensor Tower e data.ai.",
    icon: "Smartphone",
    required_fields: ["name"],
    providers: [playStoreProvider, appStoreProvider, appFollowProvider, sensorTowerProvider, dataAiProvider],
  },
  {
    id: "reputation",
    label: "Reputação & satisfação",
    description: "Reclame Aqui, consumidor.gov, Google Maps, Trustpilot, Glassdoor.",
    icon: "Star",
    required_fields: ["name"],
    optional_fields: ["website"],
    providers: [reclameAquiProvider, consumidorGovProvider, googleMapsReviewsProvider, trustpilotProvider, glassdoorProvider],
  },
  {
    id: "legal",
    label: "Jurídico & regulatório",
    description: "JusBrasil, DOU, Procon-SP, BACEN.",
    icon: "Scale",
    required_fields: ["name"],
    optional_fields: ["cnpj"],
    providers: [jusBrasilProvider, douProvider, proconSpProvider, bacenIfProvider],
  },
  {
    id: "funding",
    label: "Funding & M&A",
    description: "Crunchbase, Tracxn, StartupBase — startups e funding.",
    icon: "Coins",
    required_fields: ["name"],
    optional_fields: ["website"],
    providers: [crunchbaseBasicProvider, tracxnProvider, startupBaseProvider],
  },
  {
    id: "news-extended",
    label: "Notícias (ampliada)",
    description: "Google News RSS e GDELT — além do Tavily.",
    icon: "Newspaper",
    required_fields: ["name"],
    providers: [googleNewsRssProvider, gdeltProvider],
  },
  {
    id: "social-voice",
    label: "Voz orgânica",
    description: "Reddit, Hacker News, YouTube e Product Hunt — discussões e reviews.",
    icon: "MessageSquare",
    required_fields: ["name"],
    optional_fields: ["website"],
    providers: [redditProvider, hnAlgoliaProvider, youtubeDataProvider, productHuntProvider],
  },
  {
    id: "trends",
    label: "Demanda & tendências",
    description: "Google Trends — interesse ao longo do tempo e termos correlatos.",
    icon: "TrendingUp",
    required_fields: ["name"],
    providers: [googleTrendsProvider],
  },
  {
    id: "web-footprint",
    label: "Pegada web",
    description: "crt.sh, sitemap/robots, rotas de produto, histórico Wayback e CrUX.",
    icon: "Globe",
    required_fields: ["website"],
    providers: [crtShProvider, sitemapRobotsProvider, productPathsProvider, waybackCdxProvider, pageSpeedProvider],
  },
  {
    id: "infra",
    label: "Infraestrutura & segurança",
    description: "Shodan, SecurityTrails e crt.sh — footprint técnico exposto.",
    icon: "Server",
    required_fields: ["website"],
    providers: [shodanProvider, securityTrailsProvider, crtShProvider],
  },
  {
    id: "regulatory-br",
    label: "Regulatório BR (reclamações & processos)",
    description: "BACEN Ranking de Reclamações e DataJud (CNJ) — processos judiciais.",
    icon: "Scale",
    required_fields: ["name"],
    providers: [bacenRankingProvider, datajudCnjProvider],
  },
  {
    id: "ecommerce-stack",
    label: "Stack & integrações e-commerce",
    description: "BuiltWith/tech stack, SimilarWeb e apps em Nuvemshop, VTEX, Tray, Shopify.",
    icon: "Boxes",
    required_fields: ["website"],
    optional_fields: ["name"],
    providers: [builtwithProvider, similarwebProvider, ecommercePlatformsProvider],
  },
  {
    id: "pricing-features",
    label: "Comercial: preços & produtos",
    description: "Crawl de preços/planos/taxas, comparativos e reviews de produto.",
    icon: "DollarSign",
    required_fields: ["name"],
    optional_fields: ["website"],
    providers: [pricingPagesProvider, comparisonSitesProvider, productReviewsProvider],
  },
];

export const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id, m]));

export function resolveModules(ids: string[]): ResearchModule[] {
  const set = new Set(ids);
  return MODULES.filter((m) => m.always_on || set.has(m.id));
}
