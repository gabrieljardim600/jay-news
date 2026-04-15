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

export const MODULES: ResearchModule[] = [
  {
    id: "core",
    label: "Núcleo",
    description: "Pesquisa web, Wikipedia, site oficial e brapi. Sempre ativo.",
    icon: "Sparkles",
    always_on: true,
    providers: [tavilyCoreProvider, wikipediaProvider, websiteProvider, brapiProvider],
  },
  {
    id: "corporate-registry",
    label: "Registro corporativo",
    description: "BrasilAPI, Receita Federal (minhareceita), BACEN, Juntas Comerciais.",
    icon: "FileText",
    providers: [brasilApiCnpjProvider, minhaReceitaProvider, bacenIfProvider, jucespProvider],
  },
  {
    id: "financial-public",
    label: "Financeiro (empresa aberta)",
    description: "CVM — FRE e Fatos/Apresentações (RI).",
    icon: "TrendingUp",
    providers: [cvmFreProvider, cvmRiProvider],
  },
  {
    id: "gov-contracts",
    label: "Contratos governo",
    description: "Portal da Transparência — contratos federais por CNPJ.",
    icon: "Landmark",
    providers: [portalTransparenciaProvider],
  },
  {
    id: "leadership",
    label: "Liderança & time",
    description: "CVM FRE + LinkedIn (busca pública direcionada).",
    icon: "Users",
    providers: [cvmFreProvider, linkedinPublicProvider],
  },
  {
    id: "ip",
    label: "Propriedade intelectual",
    description: "Patentes no INPI (BR), Google Patents e homologação ANATEL.",
    icon: "Lightbulb",
    providers: [patentsProvider, anatelHomologacaoProvider],
  },
  {
    id: "paid-marketing",
    label: "Marketing pago",
    description: "Meta, TikTok, Google Ads Transparency e LinkedIn Ad Library.",
    icon: "Megaphone",
    providers: [metaAdLibraryProvider, tiktokCreativeProvider, googleAdsTransparencyProvider, linkedinAdLibraryProvider],
  },
  {
    id: "mobile",
    label: "Apps mobile",
    description: "Play/App Store + AppFollow, Sensor Tower e data.ai.",
    icon: "Smartphone",
    providers: [playStoreProvider, appStoreProvider, appFollowProvider, sensorTowerProvider, dataAiProvider],
  },
  {
    id: "reputation",
    label: "Reputação & satisfação",
    description: "Reclame Aqui, consumidor.gov, Google Maps, Trustpilot, Glassdoor.",
    icon: "Star",
    providers: [reclameAquiProvider, consumidorGovProvider, googleMapsReviewsProvider, trustpilotProvider, glassdoorProvider],
  },
  {
    id: "legal",
    label: "Jurídico & regulatório",
    description: "JusBrasil, DOU, Procon-SP, BACEN.",
    icon: "Scale",
    providers: [jusBrasilProvider, douProvider, proconSpProvider, bacenIfProvider],
  },
  {
    id: "funding",
    label: "Funding & M&A",
    description: "Crunchbase, Tracxn, StartupBase — startups e funding.",
    icon: "Coins",
    providers: [crunchbaseBasicProvider, tracxnProvider, startupBaseProvider],
  },
  {
    id: "news-extended",
    label: "Notícias (ampliada)",
    description: "Google News RSS e GDELT — além do Tavily.",
    icon: "Newspaper",
    providers: [googleNewsRssProvider, gdeltProvider],
  },
  {
    id: "social-voice",
    label: "Voz orgânica",
    description: "Reddit, Hacker News, YouTube e Product Hunt — discussões e reviews.",
    icon: "MessageSquare",
    providers: [redditProvider, hnAlgoliaProvider, youtubeDataProvider, productHuntProvider],
  },
  {
    id: "trends",
    label: "Demanda & tendências",
    description: "Google Trends — interesse ao longo do tempo e termos correlatos.",
    icon: "TrendingUp",
    providers: [googleTrendsProvider],
  },
  {
    id: "web-footprint",
    label: "Pegada web",
    description: "crt.sh, sitemap/robots, rotas de produto, histórico Wayback e CrUX.",
    icon: "Globe",
    providers: [crtShProvider, sitemapRobotsProvider, productPathsProvider, waybackCdxProvider, pageSpeedProvider],
  },
  {
    id: "infra",
    label: "Infraestrutura & segurança",
    description: "Shodan, SecurityTrails e crt.sh — footprint técnico exposto.",
    icon: "Server",
    providers: [shodanProvider, securityTrailsProvider, crtShProvider],
  },
];

export const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id, m]));

export function resolveModules(ids: string[]): ResearchModule[] {
  const set = new Set(ids);
  return MODULES.filter((m) => m.always_on || set.has(m.id));
}
