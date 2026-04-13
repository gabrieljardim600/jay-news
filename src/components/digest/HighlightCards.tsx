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
          <Card className="h-full hover:border-primary/40 hover:shadow-lg hover:shadow-black/10 transition-colors">
            {i === 0 ? (
              article.image_url ? (
                <div className="relative w-full h-48 mb-3 rounded overflow-hidden bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={article.image_url}
                    alt={article.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-48 mb-3 rounded bg-surface-light flex items-center justify-center text-text-muted text-xs">{article.source_name}</div>
              )
            ) : (
              article.image_url ? (
                <div className="relative w-full h-32 mb-3 rounded overflow-hidden bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={article.image_url}
                    alt={article.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-32 mb-3 rounded bg-surface-light flex items-center justify-center text-text-muted text-xs">{article.source_name}</div>
              )
            )}
            <h3 className={i === 0 ? "text-lg font-bold leading-snug text-text mb-1" : "font-semibold text-text mb-1"}>{article.title}</h3>
            <p className={`text-sm text-text-secondary mb-2${i === 0 ? " line-clamp-3" : " line-clamp-2"}`}>
              {article.summary}
            </p>
            <Badge>{article.source_name}</Badge>
          </Card>
        </a>
      ))}
    </div>
  );
}
