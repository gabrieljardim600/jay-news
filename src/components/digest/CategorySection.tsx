"use client";

import { useState } from "react";
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
        className="flex items-center justify-between w-full text-left py-2"
        onClick={() => setOpen(!open)}
      >
        <h2 className="text-lg font-semibold">
          {name}{" "}
          <span className="text-sm font-normal text-text-muted">
            ({articles.length})
          </span>
        </h2>
        <span className="text-text-muted text-sm">{open ? "Fechar" : "Abrir"}</span>
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
