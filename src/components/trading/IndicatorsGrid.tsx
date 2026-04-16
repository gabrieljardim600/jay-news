"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { MarketIndicator } from "@/lib/trading/types";

const CATEGORY_LABEL: Record<string, string> = {
  indice: "Índices",
  moeda: "Moedas",
  commodity: "Commodities",
  juros: "Juros",
  cripto: "Cripto",
};

const CATEGORY_ORDER = ["indice", "moeda", "juros", "commodity", "cripto"];

function dirColor(d: MarketIndicator["direction"]): string {
  if (d === "up") return "text-green-500";
  if (d === "down") return "text-red-500";
  return "text-text-muted";
}

function dirBg(d: MarketIndicator["direction"]): string {
  if (d === "up") return "bg-green-500/8";
  if (d === "down") return "bg-red-500/8";
  return "bg-surface";
}

function DirIcon({ d }: { d: MarketIndicator["direction"] }) {
  if (d === "up") return <TrendingUp className="w-3 h-3" />;
  if (d === "down") return <TrendingDown className="w-3 h-3" />;
  return <Minus className="w-3 h-3" />;
}

export function IndicatorsGrid({ indicators }: { indicators: MarketIndicator[] }) {
  if (!indicators || indicators.length === 0) return null;

  const grouped = new Map<string, MarketIndicator[]>();
  for (const ind of indicators) {
    const cat = ind.category || "indice";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(ind);
  }

  const sortedCategories = [...grouped.keys()].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
  );

  return (
    <div className="p-4 rounded-[14px] border border-border bg-surface mb-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold">Indicadores & preços</h3>
        <span className="text-[10px] text-text-muted">{indicators.length} ativos</span>
      </div>
      <div className="flex flex-col gap-3">
        {sortedCategories.map((cat) => (
          <div key={cat}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
              {CATEGORY_LABEL[cat] ?? cat}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {grouped.get(cat)!.map((ind, i) => (
                <div
                  key={`${cat}-${i}`}
                  className={`px-3 py-2.5 rounded-[10px] border border-border/60 ${dirBg(ind.direction)} transition-colors`}
                >
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[11px] text-text-muted font-medium truncate">{ind.name}</span>
                    {ind.region !== "BR" && (
                      <span className="text-[9px] text-text-muted/70 shrink-0">{ind.region}</span>
                    )}
                  </div>
                  <p className="text-[16px] font-bold tabular-nums leading-tight tracking-tight truncate">{ind.value}</p>
                  {ind.change && (
                    <div className={`flex items-center gap-1 mt-0.5 ${dirColor(ind.direction)}`}>
                      <DirIcon d={ind.direction} />
                      <span className="text-[11px] font-medium tabular-nums">{ind.change}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
