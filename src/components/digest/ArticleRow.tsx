"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { relativeDate } from "@/lib/utils/relative-date";
import { useViewMode } from "@/context/ViewModeContext";
import type { Article } from "@/types";

interface ArticleRowProps {
  article: Article;
}

export function ArticleRow({ article }: ArticleRowProps) {
  const [expanded, setExpanded] = useState(false);
  const viewMode = useViewMode();
  const hasFullContent = !!article.full_content && article.full_content.length > 50;
  const cleanPreview = article.full_content
    ? article.full_content.slice(0, 200).replace(/\n+/g, " ").trim() + (article.full_content.length > 200 ? "…" : "")
    : article.summary;

  return (
    <div className="py-4 border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left group"
      >
        <div className="flex items-start gap-3">
          {/* Text content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-text leading-snug group-hover:text-primary transition-colors">
              {article.title}
            </h3>

            {!expanded && (
              <p className="text-[13px] text-text-secondary mt-1 line-clamp-2 leading-relaxed">
                {viewMode === "clean" ? cleanPreview : article.summary}
              </p>
            )}

            {/* Metadata row — always visible */}
            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-1.5">
              <span className="text-[11px] font-medium text-text-muted uppercase tracking-wide shrink-0 max-w-[180px] truncate">
                {article.source_name}
              </span>
              {article.published_at && (
                <>
                  <span className="text-text-muted text-[11px] shrink-0">·</span>
                  <span className="text-[11px] text-text-muted shrink-0">
                    {relativeDate(article.published_at)}
                  </span>
                </>
              )}
              {hasFullContent && !expanded && (
                <>
                  <span className="text-text-muted text-[11px] shrink-0">·</span>
                  <span className="text-[11px] text-primary font-medium shrink-0">Matéria completa</span>
                </>
              )}
            </div>
          </div>

          {/* Thumbnail — only when collapsed */}
          {article.image_url && !expanded && (
            <div className="w-[72px] h-[72px] rounded-[10px] overflow-hidden bg-surface shrink-0 self-start mt-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.image_url}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}

          {/* Expand chevron */}
          <ChevronDown
            className={`w-4 h-4 text-text-muted shrink-0 mt-1 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-4">
          {article.image_url && (
            <div className="w-full h-44 rounded-[12px] overflow-hidden bg-surface mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.image_url}
                alt={article.title}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
              />
            </div>
          )}

          {/* AI summary box — hidden in clean mode */}
          {viewMode === "summary" && (
            <div className="bg-surface rounded-[10px] p-3 mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-1.5">Resumo IA</p>
              <p className="text-[14px] text-text leading-relaxed">{article.summary}</p>
            </div>
          )}

          {/* Full article content */}
          {hasFullContent && (
            <div className="text-[14px] text-text-secondary leading-[1.7] whitespace-pre-line mb-4 space-y-2">
              {article.full_content}
            </div>
          )}

          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] text-primary font-medium hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir na fonte
          </a>
        </div>
      )}
    </div>
  );
}
