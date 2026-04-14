"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { SourceTestResult } from "@/types";

interface SourceTestCardProps {
  result: SourceTestResult;
}

export function SourceTestCard({ result }: SourceTestCardProps) {
  if (result.status === "error") {
    return (
      <Card className="border-danger/30 mt-2 py-3">
        <div className="flex items-center gap-2 mb-1">
          <Badge className="bg-danger/20 text-danger">Erro</Badge>
          <span className="text-sm text-text-secondary">{result.error_code}</span>
        </div>
        <p className="text-sm text-text-muted">{result.error_message}</p>
      </Card>
    );
  }

  return (
    <Card className="border-success/30 mt-2 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-success/20 text-success">Fonte valida</Badge>
        <span className="font-medium text-sm">{result.feed_name}</span>
        <span className="text-xs text-text-muted">{result.total_articles} artigos</span>
        {result.fetch_method && result.fetch_method !== "rss" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
            via {result.fetch_method === "tavily" ? "Tavily" : "Scraper"}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {result.sample_articles?.map((article, i) => (
          <div key={i} className="text-sm flex justify-between gap-4">
            <span className="text-text-secondary truncate">{article.title}</span>
            {article.published_at && (
              <span className="text-text-muted text-xs whitespace-nowrap shrink-0">
                {new Date(article.published_at).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
