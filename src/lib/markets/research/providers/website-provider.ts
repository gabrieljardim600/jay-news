import { fetchWebsiteMeta } from "../website";
import type { ResearchProvider } from "../types";

export const websiteProvider: ResearchProvider = {
  id: "website",
  label: "Site oficial",
  description: "Scrape do homepage — meta tags, og:image, paleta de cores.",
  enabled: (c) => !!c.website,
  async fetch(competitor) {
    if (!competitor.website) return null;
    const meta = await fetchWebsiteMeta(competitor.website);
    if (!meta) return null;

    const lines = [
      meta.title && `Title: ${meta.title}`,
      meta.description && `Meta description: ${meta.description}`,
      meta.headline && `Headline H1: ${meta.headline}`,
      meta.themeColor && `Theme color (meta): ${meta.themeColor}`,
      meta.bodySnippet && `Conteúdo inicial: ${meta.bodySnippet}`,
    ].filter(Boolean).join("\n");

    const colors = [
      ...(meta.themeColor ? [meta.themeColor] : []),
      ...meta.detectedColors,
    ].filter((c, i, a) => a.indexOf(c) === i);

    return {
      providerId: this.id,
      label: "Site oficial",
      text: lines,
      hints: {
        ...(meta.ogImage ? { logo_url: meta.ogImage } : {}),
        ...(colors.length ? { colors } : {}),
      },
    };
  },
};
