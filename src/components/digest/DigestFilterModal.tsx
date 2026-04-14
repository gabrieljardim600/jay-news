"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Plus, Loader2, Check } from "lucide-react";
import type { Article, Topic } from "@/types";

export type ViewMode = "summary" | "clean";

interface Props {
  open: boolean;
  onClose: () => void;
  articles: Article[];
  topics: Topic[];
  selectedSources: Set<string>;
  selectedTopics: Set<string>;
  onToggleSource: (source: string) => void;
  onToggleTopic: (topicId: string) => void;
  onClearFilters: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onPullMore: (source: string) => Promise<void>;
}

export function DigestFilterModal({
  open, onClose, articles, topics,
  selectedSources, selectedTopics,
  onToggleSource, onToggleTopic, onClearFilters,
  viewMode, onViewModeChange, onPullMore,
}: Props) {
  const [pulling, setPulling] = useState<Set<string>>(new Set());

  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of articles) counts.set(a.source_name, (counts.get(a.source_name) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [articles]);

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of articles) {
      const key = a.topic_id || "uncategorized";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [articles]);

  const topicName = (id: string) =>
    id === "uncategorized" ? "Outros" : (topics.find((t) => t.id === id)?.name || "—");

  async function handlePullMore(source: string) {
    setPulling((prev) => new Set(prev).add(source));
    try {
      await onPullMore(source);
    } finally {
      setPulling((prev) => {
        const next = new Set(prev);
        next.delete(source);
        return next;
      });
    }
  }

  const hasFilters = selectedSources.size > 0 || selectedTopics.size > 0;

  return (
    <Modal open={open} onClose={onClose} title="Filtrar e visualizar">
      {/* View mode toggle */}
      <div className="mb-5">
        <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
          Modo de visualização
        </div>
        <div className="flex gap-1.5 p-1 rounded-full bg-surface w-fit">
          <button
            type="button"
            onClick={() => onViewModeChange("summary")}
            className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
              viewMode === "summary" ? "bg-card-solid text-text shadow-sm" : "text-text-muted hover:text-text"
            }`}
          >
            Resumo da IA
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("clean")}
            className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
              viewMode === "clean" ? "bg-card-solid text-text shadow-sm" : "text-text-muted hover:text-text"
            }`}
          >
            Artigo original
          </button>
        </div>
      </div>

      {/* Topic filter */}
      {topicCounts.length > 1 && (
        <div className="mb-5">
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
            Temas
          </div>
          <div className="flex flex-wrap gap-1.5">
            {topicCounts.map(([id, count]) => {
              const active = selectedTopics.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onToggleTopic(id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition-all ${
                    active
                      ? "bg-primary text-white"
                      : "bg-surface text-text-secondary hover:bg-surface-light"
                  }`}
                >
                  {active && <Check className="w-3 h-3" />}
                  {topicName(id)}
                  <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sources */}
      <div>
        <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
          Fontes ({sourceCounts.length})
        </div>
        <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto">
          {sourceCounts.map(([src, count]) => {
            const active = selectedSources.has(src);
            const isPulling = pulling.has(src);
            return (
              <div
                key={src}
                className="flex items-center gap-2 px-2.5 py-2 rounded-[9px] hover:bg-surface transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onToggleSource(src)}
                  className="flex-1 flex items-center justify-between text-left min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                      active ? "bg-primary border-primary" : "border-text-muted"
                    }`}>
                      {active && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="text-[13px] truncate">{src}</span>
                  </div>
                  <span className="text-[12px] text-text-muted shrink-0 ml-2">{count}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePullMore(src)}
                  disabled={isPulling}
                  title="Puxar mais artigos desta fonte"
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-light disabled:opacity-50 text-text-muted hover:text-primary transition-colors"
                >
                  {isPulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 text-[12px] text-text-muted hover:text-text underline"
        >
          Limpar filtros
        </button>
      )}
    </Modal>
  );
}
