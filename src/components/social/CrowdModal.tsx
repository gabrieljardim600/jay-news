"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import type { CrowdSource, CrowdPlatform } from "@/types";

interface CrowdModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { platform: CrowdPlatform; identifier: string; label: string }) => void;
  source?: CrowdSource;
  loading?: boolean;
}

const PLATFORM_OPTIONS = [
  { value: "reddit", label: "Reddit (subreddit)" },
];

export function CrowdModal({ open, onClose, onSave, source, loading }: CrowdModalProps) {
  const [platform, setPlatform] = useState<CrowdPlatform>("reddit");
  const [identifier, setIdentifier] = useState("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (source) {
      setPlatform(source.platform);
      setIdentifier(source.identifier);
      setLabel(source.label);
    } else {
      setPlatform("reddit");
      setIdentifier("");
      setLabel("");
    }
  }, [source, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !label.trim()) return;
    onSave({ platform, identifier: identifier.trim(), label: label.trim() });
  }

  return (
    <Modal open={open} onClose={onClose} title={source ? "Editar fonte" : "Nova fonte do Pulso"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label="Plataforma"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as CrowdPlatform)}
          options={PLATFORM_OPTIONS}
        />
        <Input
          label="Identificador"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={platform === "reddit" ? "investimentos (sem r/)" : ""}
          required
        />
        <Input
          label="Nome"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: r/investimentos"
          required
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Salvar</Button>
        </div>
      </form>
    </Modal>
  );
}
