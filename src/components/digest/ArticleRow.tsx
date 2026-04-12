import { Badge } from "@/components/ui/Badge";
import type { Article } from "@/types";

interface ArticleRowProps {
  article: Article;
}

export function ArticleRow({ article }: ArticleRowProps) {
  return (
    <a
      href={article.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-1 p-3 rounded-md hover:bg-surface-light transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-text">{article.title}</span>
      </div>
      <p className="text-sm text-text-secondary line-clamp-2">{article.summary}</p>
      <div className="flex items-center gap-2 mt-1">
        <Badge>{article.source_name}</Badge>
        {article.published_at && (
          <span className="text-xs text-text-muted">
            {new Date(article.published_at).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>
    </a>
  );
}
