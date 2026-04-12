"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SourceModal } from "./SourceModal";
import type { RssSource, Topic } from "@/types";

interface SourcesListProps {
  sources: RssSource[];
  topics: Topic[];
  onRefresh: () => void;
}

export function SourcesList({ sources, topics, onRefresh }: SourcesListProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RssSource | undefined>();
  const [loading, setLoading] = useState(false);

  const getTopicName = (topicId: string | null) =>
    topics.find((t) => t.id === topicId)?.name || "—";

  async function handleSave(data: { name: string; url: string; topic_id: string | null }) {
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
          body: JSON.stringify(data),
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

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
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
