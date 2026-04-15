import type { ResearchProvider } from "../types";

/**
 * Reclame Aqui não tem API pública. Usamos scrape leve da página de busca
 * pública. Extrai nota (RA7) e número aproximado de reclamações. Pode
 * quebrar se eles mudarem o HTML — tratar falhas como "sem dados".
 */

function extractNumber(html: string, regex: RegExp): number | null {
  const m = html.match(regex);
  if (!m) return null;
  const n = Number(m[1].replace(/[^\d.]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function findCompanyUrl(name: string): Promise<string | null> {
  const searchUrl = `https://iosite.reclameaqui.com.br/raichu-io-site-v1/company/shortname/search?query=${encodeURIComponent(name)}`;
  try {
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 JNews/1.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const arr: Array<{ shortname?: string; companyName?: string }> = await res.json();
    const first = arr[0];
    if (!first?.shortname) return null;
    return `https://www.reclameaqui.com.br/empresa/${first.shortname}/`;
  } catch {
    return null;
  }
}

export const reclameAquiProvider: ResearchProvider = {
  id: "reclame-aqui",
  label: "Reclame Aqui",
  description: "Nota RA, volume de reclamações e índice de solução (scraping).",
  enabled: (_c, m) => m.language === "pt-BR",
  async fetch(competitor) {
    const pageUrl = await findCompanyUrl(competitor.name);
    if (!pageUrl) return null;
    try {
      const res = await fetch(pageUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; JNews/1.0)", "Accept": "text/html" },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) return null;
      const html = await res.text();
      const score = extractNumber(html, /"finalScore"\s*:\s*"?([0-9.,]+)"?/i) ?? extractNumber(html, /nota-ra[^>]*>\s*([0-9.,]+)/i);
      const total = extractNumber(html, /"totalComplains"\s*:\s*"?([0-9.,]+)"?/i);
      const resolved = extractNumber(html, /"solvedPercentual"\s*:\s*"?([0-9.,]+)"?/i);
      const lines = [
        `URL do perfil: ${pageUrl}`,
        score != null ? `Nota RA: ${score}/10` : null,
        total != null ? `Total de reclamações: ${total.toLocaleString("pt-BR")}` : null,
        resolved != null ? `% resolvidas: ${resolved}%` : null,
      ].filter(Boolean) as string[];
      if (lines.length === 1) return null;
      return {
        providerId: this.id,
        label: "Reclame Aqui",
        text: lines.join("\n"),
        hints: { reclame_aqui: { score: score ?? undefined, total: total ?? undefined, resolved_pct: resolved ?? undefined } },
      };
    } catch {
      return null;
    }
  },
};
