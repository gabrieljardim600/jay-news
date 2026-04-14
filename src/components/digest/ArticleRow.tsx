"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { relativeDate } from "@/lib/utils/relative-date";
import type { Article } from "@/types";

interface ArticleRowProps {
  article: Article;
}

export function ArticleRow({ article }: ArticleRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="py-4 border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left group"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-text leading-snug group-hover:text-primary transition-colors">
              {article.title}
            </h3>
            <p className="text-[13px] text-text-secondary mt-1 line-clamp-2 leading-relaxed">
              {article.summary}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] font-medium text-text-muted uppercase tracking-wide">
                {article.source_name}
              </span>
              {article.published_at && (
                <>
                  <span className="text-text-muted text-[11px]">·</span>
                  <span className="text-[11px] text-text-muted">
                    {relativeDate(article.published_at)}
                  </span>
                </>
              )}
            </div>
          </div>
          {article.image_url && !expanded && (
            <div className="w-20 h-20 rounded-[10px] overflow-hidden bg-surface shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={article.image_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <ChevronDown
            className={`w-4 h-4 text-text-muted shrink-0 mt-1 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
          {article.image_url && (
            <div className="w-full h-48 rounded-[12px] overflow-hidden bg-surface mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={article.image_url} alt={article.title} className="w-full h-full object-cover" />
            </div>
          )}
          {article.full_content ? (
            <div className="text-[14px] text-text-secondary leading-relaxed whitespace-pre-line">
              {article.full_content}
            </div>
          ) : (
            <p className="text-[14px] text-text-secondary leading-relaxed">{article.summary}</p>
          )}
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-[13px] text-primary font-medium hover:underline"
          >
            Ler na fonte
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2h6v6M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        </div>
      )}
    </div>
  );
}
