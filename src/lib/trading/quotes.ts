/**
 * Cotações estruturadas via Yahoo Finance (sem chave, endpoint público).
 *
 * Tavily search retorna manchetes/contexto mas raramente o NÚMERO da cotação
 * — especialmente em PT-BR (IBOV, USD/BRL). Sem cotação, o LLM omite o
 * indicador no JSON ("nunca invente número"). Resultado: brief sem IBOV/Dólar.
 *
 * Este módulo fetcha valores oficiais e injeta no prompt como bloco
 * "== COTAÇÕES OFICIAIS ==", pra o LLM extrair direto.
 *
 * Símbolos Yahoo Finance:
 *   ^BVSP    IBOVESPA
 *   BRL=X    USD/BRL spot
 *   ^GSPC    S&P 500
 *   ^IXIC    Nasdaq Composite
 *   ^DJI     Dow Jones
 *   DX-Y.NYB DXY (Dollar Index)
 *   ^TNX     US 10y Treasury yield
 *   CL=F     Petróleo WTI
 *   GC=F     Ouro
 *   PETR4.SA Petrobras
 *   VALE3.SA Vale
 *   ITUB4.SA Itaú
 */

export type Quote = {
  symbol: string;
  /** Display name pra prompt + UI ("IBOVESPA", "Dólar (USD/BRL)"). */
  label: string;
  /** Categoria do indicador. Espelha MarketIndicator.category. */
  category: "indice" | "moeda" | "commodity" | "juros" | "cripto";
  region: "BR" | "EUA" | "Global";
  price: number;
  change: number;
  changePercent: number;
  currency: string | null;
};

const SYMBOLS: Array<Omit<Quote, "price" | "change" | "changePercent" | "currency">> = [
  { symbol: "^BVSP",    label: "IBOVESPA",        category: "indice",    region: "BR" },
  { symbol: "BRL=X",    label: "Dólar (USD/BRL)", category: "moeda",     region: "BR" },
  { symbol: "^GSPC",    label: "S&P 500",         category: "indice",    region: "EUA" },
  { symbol: "^IXIC",    label: "Nasdaq",          category: "indice",    region: "EUA" },
  { symbol: "^DJI",     label: "Dow Jones",       category: "indice",    region: "EUA" },
  { symbol: "DX-Y.NYB", label: "DXY",             category: "moeda",     region: "EUA" },
  { symbol: "^TNX",     label: "Treasury 10y",    category: "juros",     region: "EUA" },
  { symbol: "CL=F",     label: "Petróleo WTI",    category: "commodity", region: "Global" },
  { symbol: "GC=F",     label: "Ouro",            category: "commodity", region: "Global" },
  { symbol: "PETR4.SA", label: "Petrobras (PETR4)", category: "indice",  region: "BR" },
  { symbol: "VALE3.SA", label: "Vale (VALE3)",    category: "indice",    region: "BR" },
];

const FETCH_TIMEOUT_MS = 8000;
const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        currency?: string;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
};

async function fetchOne(
  spec: (typeof SYMBOLS)[number],
): Promise<Quote | null> {
  const url = `${YAHOO_BASE}/${encodeURIComponent(spec.symbol)}?interval=1d&range=2d`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Yahoo às vezes bloqueia UA padrão de bot
        "User-Agent": "Mozilla/5.0 (compatible; JNews/1.0; +https://jay-news.local)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as YahooChartResponse;
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;

    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const change = prev != null ? price - prev : 0;
    const changePercent = prev && prev !== 0 ? (change / prev) * 100 : 0;

    return {
      symbol: spec.symbol,
      label: spec.label,
      category: spec.category,
      region: spec.region,
      price,
      change,
      changePercent,
      currency: meta.currency ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchAllQuotes(): Promise<Quote[]> {
  const settled = await Promise.allSettled(SYMBOLS.map(fetchOne));
  return settled
    .filter(
      (r): r is PromiseFulfilledResult<Quote> =>
        r.status === "fulfilled" && r.value !== null,
    )
    .map((r) => r.value);
}

/**
 * Format helper pra prompt — uma linha por cotação no formato BR.
 */
export function formatQuotesForPrompt(quotes: Quote[]): string {
  if (quotes.length === 0) return "";
  const lines = quotes.map((q) => {
    const sign = q.changePercent > 0 ? "+" : "";
    const pct = `${sign}${q.changePercent.toFixed(2)}%`;
    const priceStr = formatPrice(q);
    return `• ${q.label} (${q.region}, ${q.category}): ${priceStr} (${pct})`;
  });
  return lines.join("\n");
}

function formatPrice(q: Quote): string {
  // Formatação BR (ponto de milhar, vírgula decimal). Casas decimais por categoria.
  const decimals =
    q.category === "moeda" || q.category === "juros" ? 4 : q.price >= 1000 ? 2 : 4;
  const formatted = q.price.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });
  if (q.symbol === "BRL=X") return `R$ ${formatted}`;
  if (q.symbol === "^TNX") return `${formatted}%`;
  if (q.category === "commodity") return `US$ ${formatted}`;
  return formatted;
}
