import { createClient } from "@supabase/supabase-js";
import type { ResearchBlock, ResearchCompetitor } from "./types";

function service() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch { return null; }
}

/** Deterministic entity key shared across users. Prefers CNPJ (canonical),
 *  falls back to "name|host". Both forms are case/whitespace-normalized. */
export function entityKeyFor(c: ResearchCompetitor): string {
  const cnpj = (c.cnpj || "").replace(/\D/g, "");
  if (cnpj.length === 14) return `cnpj:${cnpj}`;
  const host = normalizeHost(c.website);
  const name = c.name.trim().toLowerCase();
  return `nh:${name}|${host || ""}`;
}

export type CachedEntry = {
  payload: ResearchBlock | null;
  hints: ResearchBlock["hints"] | null;
  fetched_at: string;
  expires_at: string;
};

export async function getCached(providerId: string, entityKey: string): Promise<CachedEntry | null> {
  const svc = service();
  const { data } = await svc
    .from("research_cache")
    .select("payload, hints, fetched_at, expires_at")
    .eq("provider_id", providerId)
    .eq("entity_key", entityKey)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data as CachedEntry;
}

export async function setCached(
  providerId: string,
  entityKey: string,
  block: ResearchBlock | null,
  ttlSeconds: number,
): Promise<void> {
  const svc = service();
  const expires = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await svc.from("research_cache").upsert(
    {
      provider_id: providerId,
      entity_key: entityKey,
      payload: block,
      hints: block?.hints ?? null,
      fetched_at: new Date().toISOString(),
      expires_at: expires,
    },
    { onConflict: "provider_id,entity_key" },
  );
}

/** TTL seconds per provider. 0 = never cache (always live). Default 1 day. */
export const PROVIDER_TTL: Record<string, number> = {
  // Estáveis: 60 dias
  "brasilapi-cnpj": 60 * 86400,
  "minha-receita": 60 * 86400,
  "bacen-if": 60 * 86400,
  "patents": 60 * 86400,
  "anatel-homologacao": 60 * 86400,
  "jucesp": 60 * 86400,
  "portal-transparencia": 30 * 86400,

  // Institucional: 30 dias
  "wikipedia": 30 * 86400,
  "cvm-fre": 30 * 86400,
  "cvm-ri": 30 * 86400,
  "crunchbase-basic": 30 * 86400,
  "tracxn": 30 * 86400,
  "startupbase": 30 * 86400,
  "linkedin-public": 30 * 86400,
  "glassdoor": 30 * 86400,
  "producthunt": 30 * 86400,

  // Semi-estável: 14 dias
  "website": 14 * 86400,
  "sitemap-robots": 14 * 86400,
  "wayback-cdx": 14 * 86400,
  "crt-sh": 14 * 86400,
  "product-paths": 14 * 86400,

  // Ratings / app stores: 7 dias
  "app-store": 7 * 86400,
  "play-store": 7 * 86400,
  "trustpilot": 7 * 86400,
  "reclame-aqui": 7 * 86400,
  "youtube-data": 7 * 86400,
  "pagespeed": 7 * 86400,

  // Notícias / tendências: 3 dias
  "hn-algolia": 3 * 86400,
  "reddit": 3 * 86400,
  "google-trends": 3 * 86400,

  // Diário: 1 dia
  "brapi": 86400,
  "gdelt": 86400,
  "google-news-rss": 86400,
  "meta-ad-library": 86400,
  "google-ads-transparency": 86400,
  "tiktok-creative": 86400,
  "linkedin-ad-library": 86400,

  // Live / não cachear
  "tavily-core": 0,
};

export function ttlFor(providerId: string): number {
  if (providerId in PROVIDER_TTL) return PROVIDER_TTL[providerId];
  return 86400; // default 1 dia
}
