"use client";

import { Plus } from "lucide-react";
import type { GossipSource, GossipTopic } from "@/lib/gossip/types";

interface FeedFiltersProps {
  topics: GossipTopic[];
  sources: GossipSource[];
  selectedTopicId?: string;
  selectedSourceId?: string;
  onTopicChange: (id?: string) => void;
  onSourceChange: (id?: string) => void;
  onAddTopic?: () => void;
  onAddSource?: () => void;
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-7 px-3 rounded-full text-[12px] font-medium transition-all duration-200 whitespace-nowrap ${
        active
          ? "bg-primary text-white shadow-sm"
          : "bg-surface text-text-secondary hover:bg-surface-light hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}

function AddChip({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="h-7 px-3 rounded-full text-[12px] font-medium whitespace-nowrap inline-flex items-center gap-1 border border-dashed border-border text-text-muted hover:text-text hover:border-primary/50 transition-all duration-200"
    >
      <Plus className="w-3 h-3" />
      {label}
    </button>
  );
}

export function FeedFilters({
  topics,
  sources,
  selectedTopicId,
  selectedSourceId,
  onTopicChange,
  onSourceChange,
  onAddTopic,
  onAddSource,
}: FeedFiltersProps) {
  if (topics.length === 0 && sources.length === 0 && !onAddTopic && !onAddSource) return null;

  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        {topics.length > 0 && (
          <Chip
            active={!selectedTopicId}
            onClick={() => onTopicChange(undefined)}
            label="Todos"
          />
        )}
        {topics.map((t) => (
          <Chip
            key={t.id}
            active={selectedTopicId === t.id}
            onClick={() => onTopicChange(t.id)}
            label={t.name}
          />
        ))}
        {onAddTopic && <AddChip onClick={onAddTopic} label="Novo topic" />}
      </div>

      {sources.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
          <Chip
            active={!selectedSourceId}
            onClick={() => onSourceChange(undefined)}
            label="Todos"
          />
          {sources.map((s) => (
            <Chip
              key={s.id}
              active={selectedSourceId === s.id}
              onClick={() => onSourceChange(s.id)}
              label={s.label}
            />
          ))}
          {onAddSource && <AddChip onClick={onAddSource} label="Nova fonte" />}
        </div>
      )}
    </div>
  );
}
