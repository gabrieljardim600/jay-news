"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ChipInput } from "@/components/ui/ChipInput";
import { ChevronDown } from "lucide-react";
import type { UserSettings, Exclusion } from "@/types";

interface AdvancedOptionsProps {
  settings: UserSettings;
  exclusions: Exclusion[];
  onSettingsChange: (updates: Partial<UserSettings>) => void;
  onAddExclusion: (keyword: string) => void;
  onRemoveExclusion: (id: string) => void;
}

export function AdvancedOptions({
  settings, exclusions,
  onSettingsChange, onAddExclusion, onRemoveExclusion,
}: AdvancedOptionsProps) {
  const [open, setOpen] = useState(false);

  const exclusionKeywords = exclusions.map((e) => e.keyword);

  function handleExclusionsChange(values: string[]) {
    const added = values.find((v) => !exclusionKeywords.includes(v));
    if (added) { onAddExclusion(added); return; }
    const removed = exclusions.find((e) => !values.includes(e.keyword));
    if (removed) onRemoveExclusion(removed.id);
  }

  return (
    <Card>
      <button
        type="button"
        className="flex items-center justify-between w-full text-left group"
        onClick={() => setOpen(!open)}
      >
        <h2 className="text-[15px] font-semibold">Opcoes avancadas</h2>
        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-4 mt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              onChange={(e) => onSettingsChange({ summary_style: e.target.value as "executive" | "detailed" })}
              options={[
                { value: "executive", label: "Executivo" },
                { value: "detailed", label: "Detalhado" },
              ]}
            />
            <Input
              label="Max artigos"
              type="number"
              value={String(settings.max_articles)}
              onChange={(e) => onSettingsChange({ max_articles: Number(e.target.value) })}
              min={1}
              max={50}
            />
          </div>
          <ChipInput
            label="Exclusoes"
            values={exclusionKeywords}
            onChange={handleExclusionsChange}
            placeholder="Termos para filtrar..."
          />
        </div>
      )}
    </Card>
  );
}
