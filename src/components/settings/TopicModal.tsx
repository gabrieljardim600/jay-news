"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ChipInput } from "@/components/ui/ChipInput";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { Topic } from "@/types";

interface TopicModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; keywords: string[]; priority: string }) => void;
  topic?: Topic;
  loading?: boolean;
}

export function TopicModal({ open, onClose, onSave, topic, loading }: TopicModalProps) {
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [priority, setPriority] = useState("medium");

  useEffect(() => {
    if (topic) {
      setName(topic.name);
      setKeywords(topic.keywords);
      setPriority(topic.priority);
    } else {
      setName("");
      setKeywords([]);
      setPriority("medium");
    }
  }, [topic, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ name, keywords, priority });
  }

  return (
    <Modal open={open} onClose={onClose} title={topic ? "Editar Tema" : "Novo Tema"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Tecnologia"
          required
        />
        <ChipInput
          label="Palavras-chave"
          values={keywords}
          onChange={setKeywords}
          placeholder="Digite e pressione Enter"
        />
        <Select
          label="Prioridade"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          options={[
            { value: "high", label: "Alta" },
            { value: "medium", label: "Media" },
            { value: "low", label: "Baixa" },
          ]}
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
