"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { RssSource, Topic } from "@/types";

interface SourceModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; url: string; topic_id: string | null }) => void;
  source?: RssSource;
  topics: Topic[];
  loading?: boolean;
}

export function SourceModal({ open, onClose, onSave, source, topics, loading }: SourceModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [topicId, setTopicId] = useState("");

  useEffect(() => {
    if (source) {
      setName(source.name);
      setUrl(source.url);
      setTopicId(source.topic_id || "");
    } else {
      setName("");
      setUrl("");
      setTopicId("");
    }
  }, [source, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ name, url, topic_id: topicId || null });
  }

  const topicOptions = [
    { value: "", label: "Nenhum" },
    ...topics.map((t) => ({ value: t.id, label: t.name })),
  ];

  return (
    <Modal open={open} onClose={onClose} title={source ? "Editar Fonte" : "Nova Fonte"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: TechCrunch"
          required
        />
        <Input
          label="URL do RSS"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/rss"
          required
        />
        <Select
          label="Tema"
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          options={topicOptions}
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
