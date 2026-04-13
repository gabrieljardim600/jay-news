"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SourceModal } from "./SourceModal";
import { SourceSuggestions } from "./SourceSuggestions";
import { WeightStars } from "@/components/wizard/WeightStars";
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

  const getTopicName = (topicId: string | null) =>
    topics.find((t) => t.id === topicId)?.name || "—";

  async function handleSave(data: { name: string; url: string; topic_id: string | null; weight: number }) {
    setLoading(true);
    try {
      if (editing) {
        await fetch("/api/sources", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...data }),
        });
      } else {
        await fetch("/api/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, digest_config_id: configId }),
        });
      }
      setModalOpen(false);
      setEditing(undefined);
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/sources?id=${id}`, { method: "DELETE" });
    onRefresh();
  }

  async function handleSuggestionAdd(suggestion: {
    name: string;
    url: string;
    topic_name: string | null;
  }) {
    setSuggestionError(null);
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: suggestion.name,
        url: suggestion.url,
        topic_id: null,
        weight: 3,
        digest_config_id: configId,
      }),
    });
    if (!res.ok) {
      setSuggestionError(
        "Não foi possível adicionar esta fonte. A URL pode ser inválida."
      );
      return;
    }
    onRefresh();
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Fontes RSS</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined);
            setModalOpen(true);
          }}
        >
          + Novo
        </Button>
      </div>
      <SourceSuggestions digestConfigId={configId} onAdd={handleSuggestionAdd} />
      {suggestionError && (
        <p className="text-xs text-danger mb-3">{suggestionError}</p>
      )}
      {sources.length === 0 && (
        <p className="text-text-muted text-sm">Nenhuma fonte cadastrada.</p>
      )}
      <div className="flex flex-col gap-2">
        {sources.map((source) => (
          <div
            key={source.id}
            className="flex items-center justify-between p-3 rounded-md bg-surface"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{source.name}</span>
              <span className="text-xs text-text-muted">{getTopicName(source.topic_id)}</span>
              <WeightStars value={source.weight ?? 3} onChange={() => {}} readOnly size="sm" />
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(source);
                  setModalOpen(true);
                }}
              >
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(source.id)}
              >
                Excluir
              </Button>
            </div>
          </div>
        ))}
      </div>
      <SourceModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(undefined);
        }}
        onSave={handleSave}
        source={editing}
        topics={topics}
        loading={loading}
      />
    </Card>
  );
}
