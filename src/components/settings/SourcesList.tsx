"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SourceModal } from "./SourceModal";
import { SourceSuggestions } from "./SourceSuggestions";
import { WeightStars } from "@/components/wizard/WeightStars";
import { Plus, Pencil, Trash2, Rss, Globe } from "lucide-react";
import type { RssSource, Topic } from "@/types";

interface SourcesListProps {
  sources: RssSource[];
  topics: Topic[];
  onRefresh: () => void;
  configId: string;
}

export function SourcesList({ sources, topics, onRefresh, configId }: SourcesListProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RssSource | undefined>();
  const [loading, setLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const getTopicName = (topicId: string | null) => topics.find((t) => t.id === topicId)?.name || "—";

  async function handleSave(data: { name: string; url: string; source_type: "rss" | "web"; topic_id: string | null; weight: number }) {
    setLoading(true);
    try {
      if (editing) {
        await fetch("/api/sources", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...data }) });
      } else {
        await fetch("/api/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, digest_config_id: configId }) });
      }
      setModalOpen(false);
      setEditing(undefined);
      onRefresh();
    } finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/sources?id=${id}`, { method: "DELETE" });
    onRefresh();
  }

  async function handleSuggestionAdd(suggestion: { name: string; url: string; topic_name: string | null }) {
    setSuggestionError(null);
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: suggestion.name, url: suggestion.url, topic_id: null, weight: 3, digest_config_id: configId }),
    });
    if (!res.ok) { setSuggestionError("Nao foi possivel adicionar. URL pode ser invalida."); return; }
    onRefresh();
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold">Fontes</h2>
        <button
          onClick={() => { setEditing(undefined); setModalOpen(true); }}
          className="flex items-center gap-1.5 text-[13px] text-primary font-medium hover:underline"
        >
          <Plus className="w-3.5 h-3.5" /> Nova
        </button>
      </div>
      <SourceSuggestions digestConfigId={configId} onAdd={handleSuggestionAdd} />
      {suggestionError && <p className="text-[12px] text-danger mb-3">{suggestionError}</p>}
      {sources.length === 0 && <p className="text-text-muted text-[13px]">Nenhuma fonte cadastrada.</p>}
      <div className="flex flex-col gap-1.5">
        {sources.map((source) => (
          <div key={source.id} className="flex items-center justify-between p-3 rounded-[10px] bg-surface">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className={`w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 ${
                source.source_type === "rss" ? "bg-primary/10" : "bg-secondary/10"
              }`}>
                {source.source_type === "rss" ? <Rss className="w-3.5 h-3.5 text-primary" /> : <Globe className="w-3.5 h-3.5 text-secondary" />}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[14px] font-medium block">{source.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted">{getTopicName(source.topic_id)}</span>
                  <WeightStars value={source.weight ?? 3} onChange={() => {}} readOnly size="sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-1 ml-2 shrink-0">
              <button onClick={() => { setEditing(source); setModalOpen(true); }} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-light text-text-muted hover:text-text transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(source.id)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-danger/10 text-text-muted hover:text-danger transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <SourceModal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(undefined); }} onSave={handleSave} source={editing} topics={topics} loading={loading} />
    </Card>
  );
}
