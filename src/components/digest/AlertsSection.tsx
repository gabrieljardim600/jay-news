import { Card } from "@/components/ui/Card";
import { ArticleRow } from "./ArticleRow";
import type { Article } from "@/types";

interface AlertsSectionProps {
  articles: Article[];
}

export function AlertsSection({ articles }: AlertsSectionProps) {
  if (!articles || articles.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-primary">
      <h2 className="text-lg font-semibold mb-2">Alertas</h2>
      <div className="flex flex-col">
        {articles.map((article) => (
          <ArticleRow key={article.id} article={article} />
        ))}
      </div>
    </Card>
  );
}
