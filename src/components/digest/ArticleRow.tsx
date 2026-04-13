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
      className="flex flex-col gap-1.5 py-3 border-b border-border/40 last:border-0 hover:bg-surface/50 transition-colors px-1 -mx-1 rounded"
    >
      <span className="text-[15px] font-medium text-text leading-snug">{article.title}</span>
      <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">{article.summary}</p>
      <div className="flex items-center gap-2 mt-0.5">
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
