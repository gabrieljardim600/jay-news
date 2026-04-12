"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ChipInput } from "@/components/ui/ChipInput";
import type { UserSettings, Exclusion } from "@/types";

interface AdvancedOptionsProps {
  settings: UserSettings;
  exclusions: Exclusion[];
  onSettingsChange: (updates: Partial<UserSettings>) => void;
  onAddExclusion: (keyword: string) => void;
  onRemoveExclusion: (id: string) => void;
}

export function AdvancedOptions({
  settings,
  exclusions,
  onSettingsChange,
  onAddExclusion,
  onRemoveExclusion,
}: AdvancedOptionsProps) {
  const [open, setOpen] = useState(false);

  const exclusionKeywords = exclusions.map((e) => e.keyword);

  function handleExclusionsChange(values: string[]) {
    const added = values.find((v) => !exclusionKeywords.includes(v));
    if (added) {
      onAddExclusion(added);
      return;
    }
    const removed = exclusions.find((e) => !values.includes(e.keyword));
    if (removed) {
      onRemoveExclusion(removed.id);
    }
  }

  return (
    <Card>
      <button
        type="button"
        className="flex items-center justify-between w-full text-left"
        onClick={() => setOpen(!open)}
      >
        <h2 className="text-lg font-semibold">Opcoes Avancadas</h2>
        <span className="text-text-muted text-sm">{open ? "Fechar" : "Abrir"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-4 mt-4">
          <Input
            label="Horario do digest"
            type="time"
            value={settings.digest_time}
            onChange={(e) => onSettingsChange({ digest_time: e.target.value })}
          />
          <Select
            label="Idioma"
            value={settings.language}
            onChange={(e) => onSettingsChange({ language: e.target.value })}
            options={[
              { value: "pt-BR", label: "Portugues (BR)" },
              { value: "en", label: "English" },
              { value: "es", label: "Espanol" },
            ]}
          />
          <Select
            label="Estilo do resumo"
            value={settings.summary_style}
            onChange={(e) =>
              onSettingsChange({
                summary_style: e.target.value as "executive" | "detailed",
              })
            }
            options={[
              { value: "executive", label: "Executivo" },
              { value: "detailed", label: "Detalhado" },
            ]}
          />
          <Input
            label="Maximo de artigos"
            type="number"
            value={String(settings.max_articles)}
            onChange={(e) =>
              onSettingsChange({ max_articles: Number(e.target.value) })
            }
            min={1}
            max={50}
          />
          <ChipInput
            label="Exclusoes (termos a ignorar)"
            values={exclusionKeywords}
            onChange={handleExclusionsChange}
            placeholder="Digite e pressione Enter"
          />
        </div>
      )}
    </Card>
  );
}
