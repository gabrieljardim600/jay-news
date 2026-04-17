import { extractDomain } from "@/lib/sources/validate-url";

const CRAWL_TIMEOUT = 10000;
const MAX_CANDIDATE_URLS = 6;

const PRIORITY_PATHS = [
  /^\/$/,
  /^\/home/i,
  /^\/sobre/i,
  /^\/about/i,
  /^\/produtos?/i,
  /^\/products?/i,
  /^\/servic/i,
  /^\/services?/i,
  /^\/pricing/i,
  /^\/planos/i,
];

/**
 * Descobre URLs internas relevantes do domínio para compor o conjunto de páginas scrapeadas.
 * Estratégia: fetch da root → parse <a href> → filtrar internos → priorizar paths óbvios.
 */
export async function discoverUrls(rootUrl: string): Promise<string[]> {
  const normalized = rootUrl.includes("://") ? rootUrl : `https://${rootUrl}`;
  const domain = extractDomain(rootUrl);
  const origin = new URL(normalized).origin;

  const html = await fetchHtml(normalized);
  if (!html) return [normalized];

  const hrefs = extractHrefs(html);
  const internal = hrefs
    .map((href) => absolutize(href, normalized))
    .filter((url): url is string => url !== null)
    .filter((url) => {
      try {
        const parsed = new URL(url);
        return parsed.hostname.endsWith(domain);
      } catch {
        return false;
      }
    });

  const unique = Array.from(new Set([normalized, ...internal]));
  const prioritized = unique.sort((a, b) => priorityScore(b) - priorityScore(a));
  return prioritized.slice(0, MAX_CANDIDATE_URLS);

  function absolutize(href: string, base: string): string | null {
    try {
      const url = new URL(href, base);
      if (!["http:", "https:"].includes(url.protocol)) return null;
      url.hash = "";
      return url.href;
    } catch {
      return null;
    }
  }

  function priorityScore(url: string): number {
    try {
      const path = new URL(url).pathname;
      if (url === normalized) return 100;
      if (new URL(url).origin !== origin) return 0;
      for (let i = 0; i < PRIORITY_PATHS.length; i++) {
        if (PRIORITY_PATHS[i].test(path)) return 90 - i * 5;
      }
      return 10;
    } catch {
      return 0;
    }
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CRAWL_TIMEOUT);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JayNewsBrandScraper/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function extractHrefs(html: string): string[] {
  const matches = [...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)];
  return matches.map((m) => m[1]).filter(Boolean);
}
