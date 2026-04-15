"use client";

import { Flame, Clock } from "lucide-react";
import type { TrendItem } from "@/types";

interface TrendsHeroProps {
  trends: TrendItem[];
}

export function TrendsHero({ trends }: TrendsHeroProps) {
  if (trends.length === 0) return null;

  const sorted = [...trends].sort((a, b) => b.article_count - a.article_count);
  const max = sorted[0]?.article_count || 1;

  return (
    <section aria-label="Trends">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted flex items-center gap-1.5">
          <Flame className="w-3 h-3" /> Trends detectadas ({sorted.length})
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {sorted.map((t, i) => {
          const intensity = Math.round((t.article_count / max) * 100);
          return (
            <article
              key={`${t.title}-${i}`}
              className="group relative p-4 rounded-[14px] bg-surface border border-border hover:border-primary/40 transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-[14px] font-semibold leading-snug line-clamp-2">{t.title}</p>
                <span
                  className="shrink-0 text-[10px] font-mono tabular-nums text-primary bg-primary/10 px-1.5 py-0.5 rounded"
                  title="Artigos mencionando"
                >
                  {t.article_count}
                </span>
              </div>
              {t.description && (
                <p className="text-[12px] text-text-secondary leading-relaxed line-clamp-2 mb-3">
                  {t.description}
                </p>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-background overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500"
                    style={{ width: `${intensity}%` }}
                  />
                </div>
                <span className="text-[10px] text-text-muted flex items-center gap-0.5 shrink-0">
                  <Clock className="w-2.5 h-2.5" /> {t.days_active}d
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
