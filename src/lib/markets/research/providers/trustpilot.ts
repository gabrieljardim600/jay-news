import type { ResearchProvider } from "../types";

/** Trustpilot expõe a página pública /review/<domain>. Extraímos o bloco
 *  JSON-LD de AggregateRating quando presente. */

function extractAggregateRating(html: string): { value: number; count: number } | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const raw = JSON.parse(m[1].trim());
      const items = Array.isArray(raw) ? raw : [raw];
      for (const item of items) {
        const agg = (item as { aggregateRating?: { ratingValue?: string; reviewCount?: string } }).aggregateRating;
        if (agg?.ratingValue) {
          return {
            value: Number(agg.ratingValue),
            count: agg.reviewCount ? Number(agg.reviewCount) : 0,
          };
        }
      }
    } catch {}
  }
  return null;
}

function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch { return null; }
}

export const trustpilotProvider: ResearchProvider = {
  id: "trustpilot",
  label: "Trustpilot",
  description: "Rating público + volume de reviews.",
  enabled: (c) => !!c.website,
  async fetch(competitor) {
    const domain = domainOf(competitor.website);
    if (!domain) return null;
    const url = `https://www.trustpilot.com/review/${domain}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; JNews/1.0)", "Accept": "text/html" },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) return null;
      const html = await res.text();
      const agg = extractAggregateRating(html);
      if (!agg) return null;
      return {
        providerId: this.id,
        label: "Trustpilot",
        text: [
          `URL: ${url}`,
          `Nota: ${agg.value.toFixed(2)}/5`,
          agg.count ? `Total de reviews: ${agg.count.toLocaleString("pt-BR")}` : null,
        ].filter(Boolean).join("\n"),
      };
    } catch {
      return null;
    }
  },
};
