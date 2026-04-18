import type { GossipPlatform, GossipSourceTier } from "./types";

export interface SourceTemplate {
  platform: GossipPlatform;
  handle: string;
  label: string;
  tier: GossipSourceTier;
  region: "br" | "int";
  category: "tabloid" | "proxy" | "community" | "video";
}

export const SOURCE_TEMPLATES: SourceTemplate[] = [
  // === RSS BR — primary ===
  { platform: "rss", handle: "https://f5.folha.uol.com.br/rss091.xml", label: "F5/UOL", tier: "primary", region: "br", category: "tabloid" },
  { platform: "rss", handle: "https://contigo.com.br/feed", label: "Contigo", tier: "primary", region: "br", category: "tabloid" },
  { platform: "rss", handle: "https://g1.globo.com/rss/g1/pop-arte/", label: "G1 Pop & Arte", tier: "primary", region: "br", category: "tabloid" },
  { platform: "rss", handle: "https://natelinha.uol.com.br/rss", label: "NaTelinha", tier: "primary", region: "br", category: "tabloid" },

  // === RSS INT — primary ===
  { platform: "rss", handle: "https://www.tmz.com/rss.xml", label: "TMZ", tier: "primary", region: "int", category: "tabloid" },
  { platform: "rss", handle: "https://pagesix.com/feed/", label: "Page Six", tier: "primary", region: "int", category: "tabloid" },
  { platform: "rss", handle: "https://www.dailymail.co.uk/tvshowbiz/index.rss", label: "Daily Mail Showbiz", tier: "primary", region: "int", category: "tabloid" },
  { platform: "rss", handle: "https://www.eonline.com/syndication/rss/news.xml", label: "E! News", tier: "primary", region: "int", category: "tabloid" },

  // === Twitter BR — proxy ===
  { platform: "twitter", handle: "hugogloss", label: "Hugo Gloss", tier: "proxy", region: "br", category: "proxy" },
  { platform: "twitter", handle: "choquei", label: "Choquei", tier: "proxy", region: "br", category: "proxy" },
  { platform: "twitter", handle: "gossipdodia", label: "Gossip do Dia", tier: "proxy", region: "br", category: "proxy" },
  { platform: "twitter", handle: "portalfamosos", label: "Portal Famosos", tier: "proxy", region: "br", category: "proxy" },

  // === Twitter INT — proxy ===
  { platform: "twitter", handle: "PopCrave", label: "Pop Crave", tier: "proxy", region: "int", category: "proxy" },
  { platform: "twitter", handle: "DeuxMoi", label: "DeuxMoi", tier: "proxy", region: "int", category: "proxy" },
  { platform: "twitter", handle: "PopBase", label: "Pop Base", tier: "proxy", region: "int", category: "proxy" },
  { platform: "twitter", handle: "PopTingz", label: "Pop Tingz", tier: "proxy", region: "int", category: "proxy" },

  // === YouTube BR — primary ===
  { platform: "youtube", handle: "@Foquinhaa", label: "Foquinha", tier: "primary", region: "br", category: "video" },
  { platform: "youtube", handle: "@PodDelas", label: "PodDelas", tier: "primary", region: "br", category: "video" },
  { platform: "youtube", handle: "@quemnatvoficial", label: "Quem Na TV", tier: "primary", region: "br", category: "video" },

  // === Reddit — aggregator ===
  { platform: "reddit", handle: "r/Fauxmoi", label: "r/Fauxmoi", tier: "aggregator", region: "int", category: "community" },
  { platform: "reddit", handle: "r/popculturechat", label: "r/popculturechat", tier: "aggregator", region: "int", category: "community" },
  { platform: "reddit", handle: "r/BBB", label: "r/BBB", tier: "aggregator", region: "br", category: "community" },
  { platform: "reddit", handle: "r/brasil", label: "r/brasil", tier: "aggregator", region: "br", category: "community" },
];

export function groupTemplates(templates: SourceTemplate[] = SOURCE_TEMPLATES) {
  const byRegion = { br: [] as SourceTemplate[], int: [] as SourceTemplate[] };
  for (const t of templates) byRegion[t.region].push(t);
  return byRegion;
}
