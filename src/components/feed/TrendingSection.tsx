import type { TrendItem } from "@/types";

interface TrendingSectionProps {
  trends: TrendItem[];
}

export function TrendingSection({ trends }: TrendingSectionProps) {
  if (trends.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-2">
      {trends.map((trend, i) => (
        <div
          key={i}
          className="flex-none bg-surface rounded-[12px] px-4 py-3 min-w-[200px] max-w-[260px] border border-border"
        >
          <span className="text-[13px] font-semibold text-text leading-tight line-clamp-1">
            {trend.title}
          </span>
          <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1">
            {trend.article_count} artigos · {trend.days_active}d
          </p>
        </div>
      ))}
    </div>
  );
}
