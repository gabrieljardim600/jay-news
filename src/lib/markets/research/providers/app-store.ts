import type { ResearchProvider } from "../types";

type ItunesResult = {
  trackName: string;
  sellerName: string;
  averageUserRating?: number;
  userRatingCount?: number;
  version?: string;
  currentVersionReleaseDate?: string;
  trackViewUrl: string;
  description?: string;
  artworkUrl512?: string;
};

export const appStoreProvider: ResearchProvider = {
  id: "app-store",
  label: "App Store (Apple)",
  description: "Rating, reviews, versão, changelog e ícone via iTunes Search API.",
  enabled: (_c, m) => m.language === "pt-BR" || true,
  async fetch(competitor, market) {
    const country = market.language === "pt-BR" ? "br" : "us";
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(competitor.name)}&country=${country}&entity=software&limit=3`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const data = (await res.json()) as { results?: ItunesResult[] };
      const results = data.results || [];
      if (results.length === 0) return null;

      const lower = competitor.name.toLowerCase();
      const best = results.find((r) =>
        r.trackName.toLowerCase().includes(lower) || r.sellerName.toLowerCase().includes(lower),
      ) ?? results[0];

      const lines = [
        `App: ${best.trackName}`,
        `Publisher: ${best.sellerName}`,
        best.averageUserRating != null ? `Nota: ${best.averageUserRating.toFixed(2)}/5 (${best.userRatingCount ?? 0} avaliações)` : null,
        best.version ? `Versão atual: ${best.version}` : null,
        best.currentVersionReleaseDate ? `Última release: ${best.currentVersionReleaseDate.slice(0, 10)}` : null,
        `URL: ${best.trackViewUrl}`,
        best.description ? `Descrição: ${best.description.slice(0, 400)}` : null,
      ].filter(Boolean) as string[];

      return {
        providerId: this.id,
        label: `App Store (iTunes · ${country.toUpperCase()})`,
        text: lines.join("\n"),
        hints: {
          app_store: {
            rating: best.averageUserRating ?? undefined,
            reviews: best.userRatingCount ?? undefined,
          },
          ...(best.artworkUrl512 && !best.artworkUrl512.includes("generic") ? { logo_url: best.artworkUrl512 } : {}),
        },
      };
    } catch {
      return null;
    }
  },
};
