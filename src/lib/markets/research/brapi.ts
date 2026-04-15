/**
 * brapi.dev — free public API for Brazilian stock market data.
 * - /api/quote/list?search=... returns tickers matching a company name (no auth)
 * - /api/quote/<ticker> returns quote data. Some modules need a token but the
 *   basic payload is free with a generous rate limit.
 * If BRAPI_TOKEN is set in env, we pass it to unlock richer modules.
 */

export type BrapiQuote = {
  ticker: string;
  longName: string | null;
  shortName: string | null;
  currency: string | null;
  regularMarketPrice: number | null;
  marketCap: number | null;
  logoUrl: string | null;
  sector: string | null;
  industry: string | null;
  longBusinessSummary: string | null;
  employees: number | null;
};

const BASE = "https://brapi.dev";

function withToken(url: string): string {
  const token = process.env.BRAPI_TOKEN;
  if (!token) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

export async function searchBrapiTicker(name: string): Promise<string | null> {
  const clean = name.trim().split(/\s+/).slice(0, 3).join(" ");
  const url = withToken(`${BASE}/api/quote/list?search=${encodeURIComponent(clean)}&limit=5`);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const stocks: Array<{ stock: string; name: string | null; close: number | null }> = data?.stocks || [];
    if (stocks.length === 0) return null;
    // Prefer exact-ish name matches; otherwise take the first result
    const lower = name.toLowerCase();
    const best = stocks.find((s) => (s.name || "").toLowerCase().includes(lower)) ?? stocks[0];
    return best.stock || null;
  } catch {
    return null;
  }
}

export async function fetchBrapiQuote(ticker: string): Promise<BrapiQuote | null> {
  // Request richer modules only when a token is configured
  const hasToken = !!process.env.BRAPI_TOKEN;
  const modules = hasToken ? "&modules=summaryProfile" : "";
  const url = withToken(`${BASE}/api/quote/${encodeURIComponent(ticker)}?${modules ? modules.slice(1) : ""}`);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.results?.[0];
    if (!r) return null;
    const profile = r.summaryProfile || {};
    return {
      ticker: r.symbol || ticker,
      longName: r.longName ?? null,
      shortName: r.shortName ?? null,
      currency: r.currency ?? null,
      regularMarketPrice: r.regularMarketPrice ?? null,
      marketCap: r.marketCap ?? null,
      logoUrl: r.logourl ?? null,
      sector: profile.sector ?? null,
      industry: profile.industry ?? null,
      longBusinessSummary: profile.longBusinessSummary ?? null,
      employees: profile.fullTimeEmployees ?? null,
    };
  } catch {
    return null;
  }
}

export async function lookupPublicCompany(name: string): Promise<BrapiQuote | null> {
  const ticker = await searchBrapiTicker(name);
  if (!ticker) return null;
  return fetchBrapiQuote(ticker);
}

function formatBRL(value: number): string {
  if (value >= 1e9) return `R$ ${(value / 1e9).toFixed(2)}bi`;
  if (value >= 1e6) return `R$ ${(value / 1e6).toFixed(2)}mi`;
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

export function formatBrapiForPrompt(q: BrapiQuote): string {
  const lines: string[] = [];
  lines.push(`Ticker: ${q.ticker} (B3)`);
  if (q.longName) lines.push(`Razão social: ${q.longName}`);
  if (q.sector) lines.push(`Setor: ${q.sector}${q.industry ? ` · ${q.industry}` : ""}`);
  if (q.marketCap) lines.push(`Valor de mercado: ${formatBRL(q.marketCap)}`);
  if (q.regularMarketPrice) lines.push(`Cotação atual: R$ ${q.regularMarketPrice.toFixed(2)}`);
  if (q.employees) lines.push(`Funcionários: ~${q.employees.toLocaleString("pt-BR")}`);
  if (q.longBusinessSummary) lines.push(`Resumo do negócio: ${q.longBusinessSummary.slice(0, 1500)}`);
  return lines.join("\n");
}
