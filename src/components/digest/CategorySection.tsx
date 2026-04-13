"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ArticleRow } from "./ArticleRow";
import type { Article } from "@/types";

interface CategorySectionProps {
  name: string;
  articles: Article[];
}

export function CategorySection({ name, articles }: CategorySectionProps) {
  const [open, setOpen] = useState(true);

  if (!articles || articles.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        className="flex items-center justify-between w-full text-left py-3 border-b border-border group"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary group-hover:text-text transition-colors">
            {name}
          </span>
          <span className="text-xs text-text-muted bg-surface px-1.5 py-0.5 rounded">
            {articles.length}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col">
          {articles.map((article) => (
            <ArticleRow key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
