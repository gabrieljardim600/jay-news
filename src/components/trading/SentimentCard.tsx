"use client";

import type { SentimentData } from "@/lib/trading/types";

function fgColor(v: number | null): string {
  if (v == null) return "text-text-muted";
  if (v <= 25) return "text-red-500";
  if (v <= 45) return "text-orange-500";
  if (v <= 55) return "text-yellow-500";
  if (v <= 75) return "text-green-500";
  return "text-emerald-500";
}

function vixColor(v: number | null): string {
  if (v == null) return "text-text-muted";
  if (v >= 30) return "text-red-500";
  if (v >= 20) return "text-yellow-500";
  return "text-green-500";
}

function Gauge({ label, value, unit, colorClass }: { label: string; value: string; unit?: string; colorClass: string }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-[80px]">
      <span className="text-[10px] text-text-muted font-medium uppercase tracking-wide">{label}</span>
      <span className={`text-[22px] font-bold tabular-nums leading-none ${colorClass}`}>{value}</span>
      {unit && <span className="text-[10px] text-text-muted">{unit}</span>}
    </div>
  );
}

export function SentimentCard({ sentiment }: { sentiment: SentimentData }) {
  return (
    <div className="p-4 rounded-[14px] border border-border bg-surface">
      <h3 className="text-[13px] font-semibold mb-3">Sentimento de mercado</h3>
      <div className="flex items-start justify-around gap-2 mb-4 py-2 rounded-[10px] bg-background border border-border/60">
        <Gauge
          label="Fear & Greed"
          value={sentiment.fear_greed != null ? String(sentiment.fear_greed) : "—"}
          unit={sentiment.fear_greed_label ?? undefined}
          colorClass={fgColor(sentiment.fear_greed)}
        />
        <div className="w-px h-10 bg-border self-center" />
        <Gauge
          label="VIX"
          value={sentiment.vix != null ? sentiment.vix.toFixed(1) : "—"}
          colorClass={vixColor(sentiment.vix)}
        />
        <div className="w-px h-10 bg-border self-center" />
        <Gauge
          label="Put/Call"
          value={sentiment.put_call != null ? sentiment.put_call.toFixed(2) : "—"}
          colorClass={sentiment.put_call != null ? (sentiment.put_call > 1 ? "text-red-500" : sentiment.put_call > 0.7 ? "text-yellow-500" : "text-green-500") : "text-text-muted"}
        />
      </div>
      {sentiment.summary && (
        <p className="text-[13px] text-text leading-relaxed">{sentiment.summary}</p>
      )}
    </div>
  );
}
