"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ChipInput } from "@/components/ui/ChipInput";
import { Button } from "@/components/ui/Button";
import type { GossipTopic, GossipTopicType } from "@/lib/gossip/types";

interface TopicFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: GossipTopic;
}

const TYPE_OPTIONS: Array<{ value: GossipTopicType; label: string }> = [
  { value: "person", label: "Pessoa" },
  { value: "couple", label: "Casal" },
  { value: "event", label: "Evento" },
  { value: "show", label: "Programa / Show" },
  { value: "brand", label: "Marca" },
];

export function TopicFormModal({ open, onClose, onSaved, existing }: TopicFormModalProps) {
  const [type, setType] = useState<GossipTopicType>("person");
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const [priority, setPriority] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (existing) {
      setType(existing.type);
      setName(existing.name);
      setAliases(existing.aliases ?? []);
      setPriority(existing.priority);
    } else {
      setType("person");
      setName("");
      setAliases([]);
      setPriority(1);
    }
  }, [existing, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const payload = {
        type,
        name: name.trim(),
        aliases,
        priority,
      };
      let res: Response;
      if (existing) {
        res = await fetch(`/api/gossip/topics/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/gossip/topics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Erro ao salvar: ${j?.error || `HTTP ${res.status}`}`);
        return;
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(`Erro de rede: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? "Editar topic" : "Novo topic"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label="Tipo"
          value={type}
          onChange={(e) => setType(e.target.value as GossipTopicType)}
          options={TYPE_OPTIONS}
        />
        <Input
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Anitta"
          required
        />
        <ChipInput
          label="Aliases (digite e Enter)"
          values={aliases}
          onChange={setAliases}
          placeholder="ex: larissa machado, anittona"
        />
        <Input
          label="Prioridade (1-5)"
          type="number"
          min={1}
          max={5}
          value={priority}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) setPriority(Math.max(1, Math.min(5, n)));
          }}
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
