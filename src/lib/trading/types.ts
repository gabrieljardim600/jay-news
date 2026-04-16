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

export type TradingBrief = {
  id: string;
  user_id: string;
  edition: TradingEdition;
  date: string;
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
