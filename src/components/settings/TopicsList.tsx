"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { TopicModal } from "./TopicModal";
import type { Topic } from "@/types";

interface TopicsListProps {
  topics: Topic[];
  onRefresh: () => void;
  configId: string;
}

export function TopicsList({ topics, onRefresh, configId }: TopicsListProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | undefined>();
  const [loading, setLoading] = useState(false);

  async function handleSave(data: { name: string; keywords: string[]; priority: string }) {
    setLoading(true);
    try {
      if (editing) {
        await fetch("/api/topics", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...data }),
        });
      } else {
        await fetch("/api/topics", {
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
    await fetch(`/api/topics?id=${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Temas</h2>
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
      {topics.length === 0 && (
        <p className="text-text-muted text-sm">Nenhum tema cadastrado.</p>
      )}
      <div className="flex flex-col gap-2">
        {topics.map((topic) => (
          <div
            key={topic.id}
            className="flex items-center justify-between p-3 rounded-md bg-surface"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{topic.name}</span>
                <Badge variant={topic.priority}>{topic.priority}</Badge>
              </div>
              {topic.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {topic.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="text-xs bg-surface-light text-text-secondary px-2 py-0.5 rounded"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(topic);
                  setModalOpen(true);
                }}
              >
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(topic.id)}
              >
                Excluir
              </Button>
            </div>
          </div>
        ))}
      </div>
      <TopicModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(undefined);
        }}
        onSave={handleSave}
        topic={editing}
        loading={loading}
      />
    </Card>
  );
}
