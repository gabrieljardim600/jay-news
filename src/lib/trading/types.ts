export type TradingEdition = "morning" | "closing";

export type AgendaEvent = {
  time: string;
  event: string;
  impact: "alto" | "medio";
  region: "BR" | "EUA" | "Global";
};

export type SentimentData = {
  fear_greed: number | null;
  fear_greed_label: string | null;
  vix: number | null;
  put_call: number | null;
  summary: string;
};

export type MarketIndicator = {
  name: string;           // "S&P 500", "IBOVESPA", "Dólar (PTAX)"
  value: string;          // "7.005,23" — formatted, as-is from source
  change: string | null;  // "+1,2%" or "-35,40 pts"
  direction: "up" | "down" | "flat";
  region: "BR" | "EUA" | "Global";
  category: "indice" | "moeda" | "commodity" | "juros" | "cripto";
};

export type TradingBrief = {
  id: string;
  user_id: string;
  edition: TradingEdition;
  date: string;
  indicators: MarketIndicator[];
  global_bullets: string[];
  brasil_bullets: string[];
  agenda: AgendaEvent[];
  sentiment: SentimentData;
  take: string;
  happened_bullets: string[] | null;
  agenda_review: string | null;
  overnight: string | null;
  closing_take: string | null;
  model_used: string;
  duration_ms: number;
  status: "processing" | "completed" | "failed";
  error: string | null;
  created_at: string;
};
