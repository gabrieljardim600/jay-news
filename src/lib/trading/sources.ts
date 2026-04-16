export const MORNING_QUERIES = [
  { label: "Futuros S&P 500", query: "S&P 500 futures pre-market today", global: true },
  { label: "Futuros Nasdaq", query: "Nasdaq futures today", global: true },
  { label: "Ásia fechamento", query: "Asia markets close today", global: true },
  { label: "DXY", query: "DXY dollar index today", global: true },
  { label: "Treasury 10y", query: "US 10 year treasury yield today", global: true },
  { label: "Petróleo WTI", query: "crude oil WTI price today", global: true },
  { label: "Ouro", query: "gold price today", global: true },
  { label: "IBOV futuro", query: "IBOVESPA futuro pré-market hoje", global: false },
  { label: "Dólar PTAX", query: "dólar PTAX câmbio hoje", global: false },
  { label: "Juros DI", query: "juros futuros DI hoje Brasil", global: false },
];

export const CLOSING_QUERIES = [
  { label: "IBOV fechamento", query: "IBOVESPA fechamento hoje resultado", global: false },
  { label: "Dólar fechou", query: "dólar comercial fechamento hoje", global: false },
  { label: "S&P 500 fechou", query: "S&P 500 close today", global: true },
  { label: "Destaque pregão", query: "destaque pregão bolsa hoje", global: false },
  { label: "After market", query: "after market S&P futures tonight", global: true },
];

export const FINANCIAL_RSS = [
  { url: "https://www.infomoney.com.br/feed/", name: "InfoMoney" },
  { url: "https://valor.globo.com/financas/rss.xml", name: "Valor Econômico" },
  { url: "https://www.bloomberglinea.com.br/feed/", name: "Bloomberg Línea" },
  { url: "https://br.investing.com/rss/news.rss", name: "Investing.com BR" },
];

export type CalendarEventDef = {
  keywords: string[];
  event: string;
  impact: "alto" | "medio";
  region: "BR" | "EUA" | "Global";
};

export const HIGH_IMPACT_EVENTS: CalendarEventDef[] = [
  { keywords: ["copom", "selic"], event: "Decisão COPOM (Selic)", impact: "alto", region: "BR" },
  { keywords: ["fomc", "fed funds", "federal reserve rate"], event: "Decisão FOMC (Fed Funds Rate)", impact: "alto", region: "EUA" },
  { keywords: ["payroll", "non-farm", "nonfarm"], event: "Payroll / Non-Farm Payrolls", impact: "alto", region: "EUA" },
  { keywords: ["ipca", "inflação brasil"], event: "IPCA (inflação BR)", impact: "alto", region: "BR" },
  { keywords: ["cpi ", "consumer price index", "inflação eua"], event: "CPI (inflação EUA)", impact: "alto", region: "EUA" },
  { keywords: ["pib brasil", "gdp brazil"], event: "PIB Brasil", impact: "alto", region: "BR" },
  { keywords: ["gdp us", "pib eua", "gdp united states"], event: "GDP EUA", impact: "alto", region: "EUA" },
  { keywords: ["pmi industrial", "pmi servico", "pmi manufacturing"], event: "PMI Industrial / Serviços", impact: "medio", region: "Global" },
  { keywords: ["retail sales", "vendas varejo eua"], event: "Retail Sales EUA", impact: "medio", region: "EUA" },
  { keywords: ["jobless claims", "pedidos seguro desemprego"], event: "Jobless Claims", impact: "medio", region: "EUA" },
  { keywords: ["ata copom", "ata do copom"], event: "Ata do COPOM", impact: "alto", region: "BR" },
  { keywords: ["ata fomc", "fomc minutes"], event: "Ata do FOMC", impact: "alto", region: "EUA" },
  { keywords: ["ppi ", "producer price", "ppi eua"], event: "PPI (preços ao produtor EUA)", impact: "medio", region: "EUA" },
  { keywords: ["balança comercial", "trade balance br"], event: "Balança comercial BR", impact: "medio", region: "BR" },
  { keywords: ["petrobras resultado", "petr4 resultado"], event: "Resultado Petrobras", impact: "alto", region: "BR" },
  { keywords: ["vale resultado", "vale3 resultado"], event: "Resultado Vale", impact: "alto", region: "BR" },
  { keywords: ["itaú resultado", "itub4"], event: "Resultado Itaú", impact: "alto", region: "BR" },
  { keywords: ["bradesco resultado", "bbdc4"], event: "Resultado Bradesco", impact: "medio", region: "BR" },
  { keywords: ["b3 resultado", "b3sa3"], event: "Resultado B3", impact: "medio", region: "BR" },
];

export const SENTIMENT_CONFIG = {
  fear_greed_url: "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
  vix_query: "VIX CBOE volatility index value today",
  put_call_query: "CBOE equity put call ratio today",
};
