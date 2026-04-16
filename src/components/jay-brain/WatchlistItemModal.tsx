"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ChipInput } from "@/components/ui/ChipInput";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { WatchlistItem, WatchlistKind } from "@/types";

interface WatchlistItemModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { kind: WatchlistKind; label: string; keywords: string[] }) => void;
  item?: WatchlistItem;
  loading?: boolean;
}

const KIND_OPTIONS = [
  { value: "asset", label: "Ativo (ex: PETR4, BTC)" },
  { value: "theme", label: "Tema (ex: Selic, IA)" },
  { value: "person", label: "Pessoa (ex: Stuhlberger)" },
  { value: "company", label: "Empresa (ex: Petrobras)" },
];

export function WatchlistItemModal({ open, onClose, onSave, item, loading }: WatchlistItemModalProps) {
  const [kind, setKind] = useState<WatchlistKind>("asset");
  const [label, setLabel] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);

  useEffect(() => {
    if (item) {
      setKind(item.kind);
      setLabel(item.label);
      setKeywords(item.keywords);
    } else {
      setKind("asset");
      setLabel("");
      setKeywords([]);
    }
  }, [item, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    onSave({ kind, label: label.trim(), keywords });
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? "Editar item" : "Novo item da watchlist"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label="Tipo"
          value={kind}
          onChange={(e) => setKind(e.target.value as WatchlistKind)}
          options={KIND_OPTIONS}
        />
        <Input
          label="Nome"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: PETR4, Selic, Luis Stuhlberger"
          required
        />
        <ChipInput
          label="Palavras-chave (opcional)"
          values={keywords}
          onChange={setKeywords}
          placeholder="Sinônimos / termos relacionados"
        />
        <p className="text-[11px] text-text-muted -mt-2">
          Palavras-chave ajudam o Jay a conectar notícias a esse item mesmo quando o nome não aparece literal.
        </p>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Salvar</Button>
        </div>
      </form>
    </Modal>
  );
}
