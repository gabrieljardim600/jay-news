import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Article } from "@/types";

interface HighlightCardsProps {
  articles: Article[];
}

export function HighlightCards({ articles }: HighlightCardsProps) {
  if (!articles || articles.length === 0) return null;

  const top = articles.slice(0, 3);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {top.map((article, i) => (
        <a
          key={article.id}
          href={article.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className={i === 0 ? "md:col-span-2" : ""}
        >
          <Card className="h-full hover:border-primary/40 transition-colors">
            {article.image_url && (
              <div className="relative w-full h-40 mb-3 rounded overflow-hidden bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.image_url}
                  alt={article.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <h3 className="font-semibold text-text mb-1">{article.title}</h3>
            <p className="text-sm text-text-secondary line-clamp-2 mb-2">
              {article.summary}
            </p>
            <Badge>{article.source_name}</Badge>
          </Card>
        </a>
      ))}
    </div>
  );
}
