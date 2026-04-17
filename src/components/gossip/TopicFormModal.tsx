"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
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
  const [suggesting, setSuggesting] = useState(false);

  async function handleSuggestAliases() {
    if (!name.trim() || !type || suggesting) return;
    setSuggesting(true);
    try {
      const res = await fetch("/api/gossip/topics/suggest-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Erro ao sugerir: ${data?.error || `HTTP ${res.status}`}`);
        return;
      }
      const incoming = Array.isArray(data?.aliases) ? (data.aliases as string[]) : [];
      const merged = Array.from(new Set([...aliases, ...incoming.map((a) => a.toLowerCase())]));
      setAliases(merged);
    } catch (err) {
      alert(`Erro de rede: ${(err as Error).message}`);
    } finally {
      setSuggesting(false);
    }
  }

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
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[13px] text-text-secondary font-medium">
              Aliases (digite e Enter)
            </label>
            <button
              type="button"
              onClick={handleSuggestAliases}
              disabled={!name.trim() || !type || suggesting}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {suggesting ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Sugerindo...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Sugerir
                </>
              )}
            </button>
          </div>
          <ChipInput
            values={aliases}
            onChange={setAliases}
            placeholder="ex: larissa machado, anittona"
          />
        </div>
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
