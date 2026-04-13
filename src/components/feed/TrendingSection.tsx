import type { TrendItem } from "@/types";

interface TrendingSectionProps {
  trends: TrendItem[];
}

export function TrendingSection({ trends }: TrendingSectionProps) {
  if (trends.length === 0) return null;

  return (
    <div className="py-4 border-b border-border">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
        📈 Em alta
      </p>
      <div className="flex flex-col">
        {trends.map((trend, i) => (
          <div
            key={i}
            className="flex flex-col gap-0.5 py-2 border-b border-border/30 last:border-0"
          >
            <span className="text-sm font-semibold text-text">{trend.title}</span>
            <p className="text-xs text-text-secondary leading-relaxed">
              {trend.description}
            </p>
            <span className="text-xs text-text-muted mt-0.5">
              {trend.days_active} dias · {trend.article_count} artigos
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
