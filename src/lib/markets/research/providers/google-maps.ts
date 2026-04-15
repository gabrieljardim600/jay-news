import type { ResearchProvider } from "../types";

type PlaceSearchResult = {
  name: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  place_id: string;
};

export const googleMapsReviewsProvider: ResearchProvider = {
  id: "google-maps",
  label: "Google Maps reviews",
  description: "Rating e volume de reviews da sede via Places API.",
  enabled: () => !!process.env.GOOGLE_PLACES_API_KEY,
  async fetch(competitor) {
    const key = process.env.GOOGLE_PLACES_API_KEY!;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(competitor.name + " sede")}&region=br&key=${key}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const data = (await res.json()) as { results?: PlaceSearchResult[] };
      const results = data.results || [];
      if (results.length === 0) return null;
      const top = results.slice(0, 3);
      const lines = top.map((r) =>
        [`• ${r.name}`, r.formatted_address && `  Endereço: ${r.formatted_address}`, r.rating != null ? `  Nota: ${r.rating}/5 (${r.user_ratings_total ?? 0} avaliações)` : null].filter(Boolean).join("\n"),
      );
      return { providerId: this.id, label: "Google Maps (Places)", text: lines.join("\n") };
    } catch { return null; }
  },
};
