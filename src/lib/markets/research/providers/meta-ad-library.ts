import type { ResearchProvider } from "../types";

type AdsResponse = {
  data?: Array<{
    page_name?: string;
    ad_creative_bodies?: string[];
    ad_creative_link_titles?: string[];
    ad_creative_link_captions?: string[];
    ad_delivery_start_time?: string;
    ad_snapshot_url?: string;
    publisher_platforms?: string[];
  }>;
};

export const metaAdLibraryProvider: ResearchProvider = {
  id: "meta-ad-library",
  label: "Meta Ad Library",
  description: "Anúncios ativos no Facebook/Instagram (Graph Ads Archive API).",
  enabled: () => !!process.env.META_AD_LIBRARY_TOKEN,
  async fetch(competitor, market) {
    const token = process.env.META_AD_LIBRARY_TOKEN!;
    const country = market.language === "pt-BR" ? "BR" : "US";
    const params = new URLSearchParams({
      access_token: token,
      search_terms: competitor.name,
      ad_reached_countries: `["${country}"]`,
      ad_active_status: "ACTIVE",
      fields: "page_name,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_captions,ad_delivery_start_time,ad_snapshot_url,publisher_platforms",
      limit: "20",
    });
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/ads_archive?${params}`, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) return null;
      const data = (await res.json()) as AdsResponse;
      const ads = data.data || [];
      if (ads.length === 0) return null;
      const byPage = new Map<string, number>();
      const platforms = new Set<string>();
      const samples: string[] = [];
      for (const ad of ads) {
        if (ad.page_name) byPage.set(ad.page_name, (byPage.get(ad.page_name) || 0) + 1);
        (ad.publisher_platforms || []).forEach((p) => platforms.add(p));
        const body = ad.ad_creative_bodies?.[0]?.slice(0, 180);
        const link = ad.ad_creative_link_titles?.[0]?.slice(0, 100);
        if (body || link) samples.push(`• ${link ? `[${link}] ` : ""}${body ?? ""}`.trim());
      }
      const top = [...byPage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      const lines = [
        `Anúncios ativos (${country}): ${ads.length}`,
        `Páginas principais: ${top.map(([n, c]) => `${n} (${c})`).join(", ")}`,
        `Plataformas: ${[...platforms].join(", ")}`,
        "Amostras de criativos:",
        ...samples.slice(0, 8),
      ];
      return {
        providerId: this.id,
        label: `Meta Ad Library (${country})`,
        text: lines.join("\n"),
        hints: { meta_ads_active: ads.length },
      };
    } catch {
      return null;
    }
  },
};
