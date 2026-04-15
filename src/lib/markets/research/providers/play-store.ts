import { searchTavily } from "@/lib/sources/search";
import type { ResearchProvider } from "../types";

/** Scrape o listing público do Play Store. O HTML não é estável, então
 *  extraímos campos via regex e metatags OG. Caímos para null se nada for
 *  confiável. */

function extractJsonLd(html: string): Record<string, unknown> | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim());
      if (data && typeof data === "object") {
        const t = (data as { "@type"?: string })["@type"];
        if (t === "MobileApplication" || t === "SoftwareApplication") return data as Record<string, unknown>;
      }
    } catch {}
  }
  return null;
}

async function findPackageUrl(name: string): Promise<string | null> {
  // Tavily restrict to play.google.com to find the package URL
  const results = await searchTavily(`${name} app`, 5, ["play.google.com"], "basic", 365);
  const hit = results.find((r) => r.url.includes("/store/apps/details?id="));
  return hit?.url ?? null;
}

export const playStoreProvider: ResearchProvider = {
  id: "play-store",
  label: "Google Play Store",
  description: "Rating, número de reviews e última atualização do app.",
  enabled: () => !!process.env.TAVILY_API_KEY,
  async fetch(competitor) {
    const url = await findPackageUrl(competitor.name);
    if (!url) return null;
    try {
      const res = await fetch(url + "&hl=pt_BR", {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; JNews/1.0)", "Accept": "text/html" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const html = await res.text();
      const ld = extractJsonLd(html);
      const agg = ld?.aggregateRating as { ratingValue?: number; ratingCount?: number } | undefined;
      const rating = agg?.ratingValue;
      const count = agg?.ratingCount;

      // Also try to find downloads from "X+ downloads" span
      const downloadsMatch = html.match(/>([\d.,]+[KMB]?\+)\s*(downloads|instalações)/i);
      const priceMatch = html.match(/"offers":\[?\{[^}]*"price":"([^"]+)"/);

      const lines = [
        `URL: ${url}`,
        rating != null ? `Nota: ${Number(rating).toFixed(2)}/5${count ? ` (${Number(count).toLocaleString("pt-BR")} avaliações)` : ""}` : null,
        downloadsMatch ? `Downloads: ${downloadsMatch[1]}` : null,
        priceMatch ? `Preço: ${priceMatch[1]}` : null,
      ].filter(Boolean) as string[];

      if (lines.length === 1) return null;
      return {
        providerId: this.id,
        label: "Google Play Store",
        text: lines.join("\n"),
        hints: {
          play_store: {
            rating: rating != null ? Number(rating) : undefined,
            reviews: count != null ? Number(count) : undefined,
          },
        },
      };
    } catch {
      return null;
    }
  },
};
