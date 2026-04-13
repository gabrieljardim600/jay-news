import { ArticleRow } from "./ArticleRow";
import type { Article } from "@/types";

interface AlertsSectionProps {
  articles: Article[];
}

export function AlertsSection({ articles }: AlertsSectionProps) {
  if (!articles || articles.length === 0) return null;

  return (
    <div className="border-l-4 border-l-primary pl-4 py-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
        ⚡ Alertas
      </p>
      <div className="flex flex-col">
        {articles.map((article) => (
          <ArticleRow key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
}
