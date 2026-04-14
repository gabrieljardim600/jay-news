"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { WeightStars } from "@/components/wizard/WeightStars";
import type { RssSource, Topic } from "@/types";

interface SourceModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; url: string; source_type: "rss" | "web"; topic_id: string | null; weight: number }) => void;
  source?: RssSource;
  topics: Topic[];
  loading?: boolean;
}

export function SourceModal({ open, onClose, onSave, source, topics, loading }: SourceModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [sourceType, setSourceType] = useState<"rss" | "web">("rss");
  const [topicId, setTopicId] = useState("");
  const [weight, setWeight] = useState(3);

  useEffect(() => {
    if (source) {
      setName(source.name);
      setUrl(source.url);
      setSourceType(source.source_type || "rss");
      setTopicId(source.topic_id || "");
      setWeight(source.weight ?? 3);
    } else {
      setName("");
      setUrl("");
      setSourceType("rss");
      setTopicId("");
      setWeight(3);
    }
  }, [source, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ name, url, source_type: sourceType, topic_id: topicId || null, weight });
  }

  const topicOptions = [
    { value: "", label: "Nenhum" },
    ...topics.map((t) => ({ value: t.id, label: t.name })),
  ];

  return (
    <Modal open={open} onClose={onClose} title={source ? "Editar Fonte" : "Nova Fonte"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex gap-1 p-0.5 rounded-md bg-surface border border-border">
          <button
            type="button"
            onClick={() => setSourceType("rss")}
            className={`flex-1 py-1.5 px-3 text-sm rounded font-medium transition-colors ${
              sourceType === "rss"
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            RSS Feed
          </button>
          <button
            type="button"
            onClick={() => setSourceType("web")}
            className={`flex-1 py-1.5 px-3 text-sm rounded font-medium transition-colors ${
              sourceType === "web"
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Website
          </button>
        </div>
        <Input
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: TechCrunch"
          required
        />
        <Input
          label={sourceType === "web" ? "Dominio do site" : "URL do RSS"}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={sourceType === "web" ? "dnews.com.br" : "https://example.com/rss"}
          required
        />
        {sourceType === "web" && (
          <p className="text-xs text-text-muted -mt-2">
            Busca avancada via Tavily — funciona com sites sem RSS
          </p>
        )}
        <Select
          label="Tema"
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          options={topicOptions}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Peso</label>
          <WeightStars value={weight} onChange={setWeight} size="md" />
          <p className="text-xs text-text-muted">
            Afeta o limite de artigos ({weight * 2} artigos max) e o boost de relevância
          </p>
        </div>
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
