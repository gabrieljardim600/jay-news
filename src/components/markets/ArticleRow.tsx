"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";

type Article = {
  id: string;
  title: string;
  source_name: string;
  source_url: string;
  summary: string | null;
  full_content: string | null;
  image_url: string | null;
  published_at: string | null;
  found_via?: "general" | "competitor";
};

export function ArticleRow({
  article,
  timeAgo,
  badges,
}: {
  article: Article;
  timeAgo: (iso: string | null | undefined) => string;
  badges?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(article.full_content);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !content && !loading) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/markets/articles/${article.id}/enrich`, { method: "POST" });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `HTTP ${res.status}`);
        }
        const data: { full_content: string | null } = await res.json();
        setContent(data.full_content);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao carregar a matéria");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className={`rounded-[12px] border transition-all ${open ? "border-primary/40 bg-surface" : "border-border bg-surface"}`}>
      <button
        onClick={toggle}
        className="w-full flex gap-3 p-3 text-left hover:bg-surface-light/40 transition-colors"
      >
        {article.image_url && (
          <div className="relative w-16 h-16 rounded-[8px] overflow-hidden bg-background shrink-0">
            <Image src={article.image_url} alt="" fill sizes="64px" className="object-cover" unoptimized />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold leading-snug ${open ? "" : "line-clamp-2"}`}>{article.title}</p>
          {article.summary && !open && (
            <p className="text-[11px] text-text-secondary mt-1 line-clamp-2">{article.summary}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] text-text-muted">{article.source_name}</span>
            {article.published_at && <span className="text-[10px] text-text-muted">· {timeAgo(article.published_at)}</span>}
            {badges?.map((b) => (
              <span key={b} className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">{b}</span>
            ))}
            {article.found_via === "competitor" && !badges?.length && (
              <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Direto</span>
            )}
            <span className="ml-auto flex items-center gap-0.5 text-[10px] text-text-muted">
              {open ? "recolher" : "abrir matéria"}
              {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>
          </div>
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border/60">
          {loading ? (
            <div className="py-6 flex items-center justify-center text-text-muted text-[12px] gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Baixando e limpando a matéria…
            </div>
          ) : error ? (
            <p className="py-4 text-[12px] text-red-500">{error}</p>
          ) : content ? (
            <article className="text-[13.5px] leading-relaxed text-text whitespace-pre-wrap">{content}</article>
          ) : article.summary ? (
            <p className="py-2 text-[12px] text-text-muted italic">
              Matéria completa indisponível nesta fonte. Resumo: {article.summary}
            </p>
          ) : (
            <p className="py-2 text-[12px] text-text-muted italic">Conteúdo indisponível.</p>
          )}
          <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between gap-2">
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-text-muted hover:text-primary flex items-center gap-1"
            >
              Abrir fonte original <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <span className="text-[10px] text-text-muted">{article.source_name}</span>
          </div>
        </div>
      )}
    </div>
  );
}
