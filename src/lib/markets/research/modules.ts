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
} from "./providers/tavily-targeted";

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
    description: "BrasilAPI (CNPJ, QSA, capital, CNAE) e registro BACEN (IFs e IPs).",
    icon: "FileText",
    providers: [brasilApiCnpjProvider, bacenIfProvider],
  },
  {
    id: "financial-public",
    label: "Financeiro (empresa aberta)",
    description: "CVM — Formulário de Referência (composição de diretoria).",
    icon: "TrendingUp",
    providers: [cvmFreProvider],
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
    description: "Patentes no INPI (BR) e Google Patents.",
    icon: "Lightbulb",
    providers: [patentsProvider],
  },
  {
    id: "paid-marketing",
    label: "Marketing pago",
    description: "Meta Ad Library (Graph API) e TikTok Creative Center.",
    icon: "Megaphone",
    providers: [metaAdLibraryProvider, tiktokCreativeProvider],
  },
  {
    id: "mobile",
    label: "Apps mobile",
    description: "Rating, reviews e changelog no Google Play e App Store.",
    icon: "Smartphone",
    providers: [playStoreProvider, appStoreProvider],
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
    id: "infra",
    label: "Infraestrutura & segurança",
    description: "Shodan e SecurityTrails — footprint técnico exposto.",
    icon: "Server",
    providers: [shodanProvider, securityTrailsProvider],
  },
];

export const MODULE_BY_ID = new Map(MODULES.map((m) => [m.id, m]));

export function resolveModules(ids: string[]): ResearchModule[] {
  const set = new Set(ids);
  return MODULES.filter((m) => m.always_on || set.has(m.id));
}
