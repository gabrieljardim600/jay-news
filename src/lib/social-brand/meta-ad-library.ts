// Meta Ad Library — anúncios públicos do Facebook + Instagram.
// Endpoint oficial gratuito: /ads_archive
// Doc: https://www.facebook.com/ads/library/api
//
// Aceita identifier no formato:
//   - "page:<page_id>"   → busca por search_page_ids
//   - "<text>"           → busca por search_terms
import type { FetchedPost, FetchedProfile, SocialBrandMediaItem } from "./types";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

interface AdArchiveEntry {
  id: string;
  ad_creation_time?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_descriptions?: string[];
  ad_snapshot_url?: string;
  page_id?: string;
  page_name?: string;
  publisher_platforms?: string[];
  languages?: string[];
  impressions?: { lower_bound?: string; upper_bound?: string };
  spend?: { lower_bound?: string; upper_bound?: string };
}

const FIELDS = [
  "id",
  "ad_creation_time",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_captions",
  "ad_creative_link_descriptions",
  "ad_snapshot_url",
  "page_id",
  "page_name",
  "publisher_platforms",
  "languages",
  "impressions",
  "spend",
].join(",");

function token(): string {
  const t = process.env.META_AD_LIBRARY_TOKEN || process.env.META_ACCESS_TOKEN;
  if (!t) throw new Error("META_AD_LIBRARY_TOKEN não configurado");
  return t;
}

export interface FetchAdsOptions {
  /** ISO country codes; default ["BR"] */
  countries?: string[];
  /** active | all | inactive; default "active" */
  status?: "ACTIVE" | "ALL" | "INACTIVE";
  /** quantos resultados máx (paginação interna); default 50 */
  limit?: number;
}

export async function fetchAdsForIdentifier(
  identifier: string,
  opts: FetchAdsOptions = {},
): Promise<{ profile: FetchedProfile; ads: FetchedPost[] }> {
  const countries = opts.countries ?? ["BR"];
  const status = opts.status ?? "ACTIVE";
  const limit = Math.min(opts.limit ?? 50, 200);

  const isPageId = identifier.startsWith("page:");
  const params = new URLSearchParams({
    access_token: token(),
    ad_reached_countries: JSON.stringify(countries),
    ad_active_status: status,
    fields: FIELDS,
    limit: String(Math.min(limit, 50)),
  });

  if (isPageId) {
    params.set("search_page_ids", JSON.stringify([identifier.slice(5)]));
  } else {
    params.set("search_terms", identifier);
  }

  const url = `${GRAPH_BASE}/ads_archive?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(`Meta Ad Library: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const items: AdArchiveEntry[] = data.data ?? [];
  const ads: FetchedPost[] = items.map(normalizeAd);

  // Profile sintético: pega o page_name mais comum
  const pageName = items[0]?.page_name ?? identifier;
  const pageId = items[0]?.page_id ?? (isPageId ? identifier.slice(5) : undefined);

  return {
    profile: { identifier, name: pageName, page_id: pageId },
    ads,
  };
}

function normalizeAd(entry: AdArchiveEntry): FetchedPost {
  const captionParts = [
    ...(entry.ad_creative_bodies ?? []),
    ...(entry.ad_creative_link_titles ?? []),
    ...(entry.ad_creative_link_descriptions ?? []),
  ].filter(Boolean);
  const caption = captionParts.length > 0 ? captionParts.join("\n\n") : null;

  // Ad Library API NÃO retorna media_url direto. snapshot_url é a única referência confiável.
  // Para mídia visual real precisaria scraping do snapshot_url (HTML público) — fora do escopo limpo.
  const media: SocialBrandMediaItem[] = entry.ad_snapshot_url
    ? [{ type: "image", url: entry.ad_snapshot_url, thumbnail_url: entry.ad_snapshot_url }]
    : [];

  const metrics: Record<string, number> = {};
  if (entry.impressions?.lower_bound) metrics.impressions_lower = Number(entry.impressions.lower_bound) || 0;
  if (entry.impressions?.upper_bound) metrics.impressions_upper = Number(entry.impressions.upper_bound) || 0;
  if (entry.spend?.lower_bound) metrics.spend_lower = Number(entry.spend.lower_bound) || 0;
  if (entry.spend?.upper_bound) metrics.spend_upper = Number(entry.spend.upper_bound) || 0;

  return {
    external_id: entry.id,
    kind: "ad",
    caption,
    permalink: entry.ad_snapshot_url ?? null,
    posted_at: entry.ad_delivery_start_time ?? entry.ad_creation_time ?? null,
    media,
    metrics,
    raw: entry as unknown as Record<string, unknown>,
  };
}
