import type { SupabaseClient } from "@supabase/supabase-js";
import { extractDomain } from "@/lib/sources/validate-url";
import { extractAssets, extractPageMeta } from "./asset-extractor";
import { extractColors } from "./color-extractor";
import { downloadAndUpload } from "./asset-downloader";
import type {
  DownloadedAsset,
  LightScrapeResult,
  PageMeta,
  RawAsset,
  ColorOccurrence,
} from "./types";

const PAGE_FETCH_TIMEOUT = 15000;
const MAX_ASSETS_PER_SCRAPE = 80;

/**
 * Fase leve: fetch + HTML parse. Coleta metadata, assets estáticos e cores
 * declaradas no HTML/CSS. Não resolve lazy-load via JS nem SPAs — isso é
 * responsabilidade do deep scrape (Puppeteer), fora do escopo do MVP.
 */
export async function runLightScrape(urls: string[]): Promise<LightScrapeResult> {
  if (urls.length === 0) throw new Error("Nenhuma URL pra scrape");
  const rootUrl = urls[0];
  const domain = extractDomain(rootUrl);

  const pages: PageMeta[] = [];
  const allAssets: RawAsset[] = [];
  const colorBuckets = new Map<string, ColorOccurrence>();
  const fontFamilies = new Set<string>();

  for (const pageUrl of urls) {
    const html = await fetchHtml(pageUrl);
    if (!html) {
      pages.push({ url: pageUrl });
      continue;
    }
    pages.push(extractPageMeta(html, pageUrl));
    for (const asset of extractAssets(html, pageUrl)) allAssets.push(asset);

    const { colors, fontFamilies: fonts } = await extractColors(html, pageUrl);
    for (const c of colors) {
      const existing = colorBuckets.get(c.hex);
      if (existing) {
        existing.occurrences += c.occurrences;
        for (const src of c.sources) {
          if (!existing.sources.includes(src)) existing.sources.push(src);
        }
      } else {
        colorBuckets.set(c.hex, { ...c });
      }
    }
    for (const f of fonts) fontFamilies.add(f);
  }

  const deduped = dedupeAssets(allAssets).slice(0, MAX_ASSETS_PER_SCRAPE);
  const colors = [...colorBuckets.values()].sort((a, b) => b.occurrences - a.occurrences);

  return {
    rootUrl,
    domain,
    pages,
    assets: deduped,
    colors,
    fontFamilies: [...fontFamilies],
  };
}

/**
 * Baixa e faz upload dos assets extraídos na fase leve. Retorna os que tiveram sucesso.
 */
export async function downloadAssets(
  supabase: SupabaseClient,
  assets: RawAsset[],
  scrapeId: string
): Promise<DownloadedAsset[]> {
  const results: DownloadedAsset[] = [];
  const CONCURRENCY = 4;
  for (let i = 0; i < assets.length; i += CONCURRENCY) {
    const batch = assets.slice(i, i + CONCURRENCY);
    const downloaded = await Promise.all(
      batch.map((asset) => downloadAndUpload(supabase, asset, scrapeId))
    );
    for (const item of downloaded) if (item) results.push(item);
  }
  return results;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT);
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JayNewsBrandScraper/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function dedupeAssets(assets: RawAsset[]): RawAsset[] {
  const seen = new Set<string>();
  const out: RawAsset[] = [];
  for (const asset of assets) {
    if (seen.has(asset.originalUrl)) continue;
    seen.add(asset.originalUrl);
    out.push(asset);
  }
  return out;
}
