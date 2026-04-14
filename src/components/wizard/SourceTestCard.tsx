"use client";

import { Check, AlertCircle } from "lucide-react";
import type { SourceTestResult } from "@/types";

interface SourceTestCardProps {
  result: SourceTestResult;
}

export function SourceTestCard({ result }: SourceTestCardProps) {
  if (result.status === "error") {
    return (
      <div className="mt-2 rounded-[10px] p-3 bg-danger/8 border border-danger/15">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-text">{result.error_code}</p>
            <p className="text-[12px] text-text-secondary">{result.error_message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-[10px] p-3 bg-success/8 border border-success/15">
      <div className="flex items-center gap-2 mb-2">
        <Check className="w-4 h-4 text-success" />
        <span className="text-[13px] font-medium text-text">{result.feed_name}</span>
        <span className="text-[11px] text-text-muted">{result.total_articles} artigos</span>
        {result.fetch_method && result.fetch_method !== "rss" && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-surface text-text-muted font-medium">
            via {result.fetch_method === "tavily" ? "Tavily" : "Scraper"}
          </span>
        )}
      </div>
      {result.sample_articles && (
        <div className="flex flex-col gap-1 pl-6">
          {result.sample_articles.map((article, i) => (
            <p key={i} className="text-[12px] text-text-secondary truncate">{article.title}</p>
          ))}
        </div>
      )}
    </div>
  );
}
