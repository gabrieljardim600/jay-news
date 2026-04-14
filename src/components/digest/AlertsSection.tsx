import { ArticleRow } from "./ArticleRow";
import type { Article } from "@/types";

interface AlertsSectionProps {
  articles: Article[];
}

export function AlertsSection({ articles }: AlertsSectionProps) {
  if (!articles || articles.length === 0) return null;

  return (
    <div className="bg-warning/5 rounded-[14px] p-4 border border-warning/10">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-warning" />
        <span className="text-[13px] font-semibold uppercase tracking-widest text-warning">
          Alertas
        </span>
      </div>
      <div className="flex flex-col">
        {articles.map((article) => (
          <ArticleRow key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
}
