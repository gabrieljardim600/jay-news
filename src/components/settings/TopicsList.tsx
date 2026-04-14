"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { TopicModal } from "./TopicModal";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
        await fetch("/api/topics", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...data }) });
      } else {
        await fetch("/api/topics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, digest_config_id: configId }) });
      }
      setModalOpen(false);
      setEditing(undefined);
      onRefresh();
    } finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/topics?id=${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold">Temas</h2>
        <button
          onClick={() => { setEditing(undefined); setModalOpen(true); }}
          className="flex items-center gap-1.5 text-[13px] text-primary font-medium hover:underline"
        >
          <Plus className="w-3.5 h-3.5" /> Novo
        </button>
      </div>
      {topics.length === 0 && <p className="text-text-muted text-[13px]">Nenhum tema cadastrado.</p>}
      <div className="flex flex-col gap-1.5">
        {topics.map((topic) => (
          <div key={topic.id} className="flex items-center justify-between p-3 rounded-[10px] bg-surface">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium">{topic.name}</span>
                <Badge variant={topic.priority}>{topic.priority}</Badge>
              </div>
              {topic.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {topic.keywords.map((kw) => (
                    <span key={kw} className="text-[11px] bg-surface-light text-text-muted px-2 py-0.5 rounded-full">{kw}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-1 ml-2 shrink-0">
              <button onClick={() => { setEditing(topic); setModalOpen(true); }} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-light text-text-muted hover:text-text transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(topic.id)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-danger/10 text-text-muted hover:text-danger transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <TopicModal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(undefined); }} onSave={handleSave} topic={editing} loading={loading} />
    </Card>
  );
}
