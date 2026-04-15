import type { ResearchProvider } from "../types";

function hostFrom(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, ""); } catch { return null; }
}

type SwData = {
  SiteName?: string;
  Category?: string;
  GlobalRank?: { Rank?: number };
  CountryRank?: { CountryCode?: number; Rank?: number };
  CategoryRank?: { Category?: string; Rank?: number };
  Engagments?: { Visits?: string; TimeOnSite?: string; PagePerVisit?: string; BounceRate?: string; Month?: string; Year?: string };
  EstimatedMonthlyVisits?: Record<string, number>;
  TrafficSources?: { Social?: number; Paid_Referral?: number; Mail?: number; Referrals?: number; Search?: number; Direct?: number };
  TopCountryShares?: Array<{ CountryCode?: number; CountryName?: string; Value?: number }>;
  TopKeywords?: Array<{ Name?: string; EstimatedValue?: number; Volume?: number }>;
};

function fmtPct(v?: number) { return v == null ? "?" : `${(v * 100).toFixed(1)}%`; }
function fmtInt(s?: string) {
  if (!s) return "?";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

/** SimilarWeb — ranking + estimativa de tráfego via endpoint público usado
 *  pela extensão oficial. Não documentado mas estável. */
export const similarwebProvider: ResearchProvider = {
  id: "similarweb",
  label: "SimilarWeb — tráfego",
  description: "Ranking global/país, visitas mensais, engajamento, top keywords.",
  searchLike: false,
  enabled: (c) => !!hostFrom(c.website),
  async fetch(competitor) {
    const host = hostFrom(competitor.website);
    if (!host) return null;
    try {
      const r = await fetch(`https://data.similarweb.com/api/v1/data?domain=${encodeURIComponent(host)}`, {
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "Mozilla/5.0 JNews/1.0" },
      });
      if (!r.ok) return null;
      const data = (await r.json()) as SwData;
      if (!data || !data.SiteName) return null;

      const visits = data.EstimatedMonthlyVisits ? Object.entries(data.EstimatedMonthlyVisits).sort().slice(-6) : [];
      const lines: string[] = [];
      lines.push(`Site: ${data.SiteName}${data.Category ? ` — ${data.Category}` : ""}`);
      if (data.GlobalRank?.Rank) lines.push(`Ranking global: #${data.GlobalRank.Rank.toLocaleString("pt-BR")}`);
      if (data.CountryRank?.Rank) lines.push(`Ranking país: #${data.CountryRank.Rank.toLocaleString("pt-BR")}`);
      if (data.CategoryRank?.Rank) lines.push(`Ranking categoria (${data.CategoryRank.Category}): #${data.CategoryRank.Rank.toLocaleString("pt-BR")}`);
      if (data.Engagments) {
        lines.push(`Visitas/mês: ${fmtInt(data.Engagments.Visits)} · Tempo no site: ${data.Engagments.TimeOnSite ?? "?"} · Páginas/visita: ${data.Engagments.PagePerVisit ?? "?"} · Bounce: ${data.Engagments.BounceRate ? `${(Number(data.Engagments.BounceRate) * 100).toFixed(1)}%` : "?"}`);
      }
      if (data.TrafficSources) {
        const t = data.TrafficSources;
        lines.push(`Fontes de tráfego — direto: ${fmtPct(t.Direct)} · orgânico: ${fmtPct(t.Search)} · ref: ${fmtPct(t.Referrals)} · social: ${fmtPct(t.Social)} · pago: ${fmtPct(t.Paid_Referral)} · email: ${fmtPct(t.Mail)}`);
      }
      if (visits.length > 0) {
        lines.push(`Histórico de visitas (últimos meses): ${visits.map(([k, v]) => `${k}: ${fmtInt(String(v))}`).join(" · ")}`);
      }
      if (data.TopKeywords && data.TopKeywords.length > 0) {
        lines.push(`Top keywords: ${data.TopKeywords.slice(0, 10).map((k) => k.Name).filter(Boolean).join(", ")}`);
      }
      if (data.TopCountryShares && data.TopCountryShares.length > 0) {
        lines.push(`Países top: ${data.TopCountryShares.slice(0, 5).map((c) => `${c.CountryName ?? c.CountryCode}: ${fmtPct(c.Value)}`).join(" · ")}`);
      }
      return { providerId: this.id, label: "SimilarWeb — tráfego & engajamento", text: lines.join("\n") };
    } catch { return null; }
  },
};
