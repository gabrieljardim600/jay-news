"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { relativeDate } from "@/lib/utils/relative-date";
import type { Article } from "@/types";

interface HighlightCardsProps {
  articles: Article[];
}

export function HighlightCards({ articles }: HighlightCardsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!articles || articles.length === 0) return null;

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.offsetWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-widest text-text-muted">
          Destaques
        </h2>
        {articles.length > 2 && (
          <div className="flex gap-1">
            <button
              onClick={() => scroll("left")}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-surface hover:bg-surface-light transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-text-secondary" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-surface hover:bg-surface-light transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4"
      >
        {articles.map((article) => (
          <a
            key={article.id}
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-none w-[280px] snap-start group"
          >
            <div className="bg-card glass rounded-[16px] border border-border overflow-hidden hover:border-primary/20 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
              {article.image_url ? (
                <div className="w-full h-[160px] overflow-hidden bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={article.image_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  />
                </div>
              ) : (
                <div className="w-full h-[160px] bg-gradient-to-br from-surface to-surface-light flex items-center justify-center">
                  <span className="text-text-muted text-[13px] font-medium">{article.source_name}</span>
                </div>
              )}
              <div className="p-4">
                <h3 className="text-[15px] font-semibold text-text leading-snug line-clamp-2 mb-1.5">
                  {article.title}
                </h3>
                <p className="text-[13px] text-text-secondary line-clamp-2 leading-relaxed mb-3">
                  {article.summary}
                </p>
                <div className="flex items-center gap-2">
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
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
