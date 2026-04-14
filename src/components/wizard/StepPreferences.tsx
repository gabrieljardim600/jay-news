"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ChipInput } from "@/components/ui/ChipInput";

interface StepPreferencesProps {
  language: string;
  summaryStyle: string;
  digestTime: string;
  maxArticles: number;
  exclusions: string[];
  onLanguageChange: (v: string) => void;
  onSummaryStyleChange: (v: string) => void;
  onDigestTimeChange: (v: string) => void;
  onMaxArticlesChange: (v: number) => void;
  onExclusionsChange: (v: string[]) => void;
}

const LANGUAGE_OPTIONS = [
  { value: "pt-BR", label: "Portugues (BR)" },
  { value: "en", label: "English" },
  { value: "es", label: "Espanol" },
];

const STYLE_OPTIONS = [
  { value: "executive", label: "Executivo (2-3 frases)" },
  { value: "detailed", label: "Detalhado (4-5 frases)" },
  { value: "complete", label: "Completo (materia inteira)" },
];

export function StepPreferences({
  language, summaryStyle, digestTime, maxArticles, exclusions,
  onLanguageChange, onSummaryStyleChange, onDigestTimeChange, onMaxArticlesChange, onExclusionsChange,
}: StepPreferencesProps) {
  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-[22px] font-bold mb-1 tracking-tight">Preferencias</h2>
        <p className="text-text-secondary text-[14px]">
          Ajuste como seu digest sera gerado.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Idioma dos resumos"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          options={LANGUAGE_OPTIONS}
        />
        <Select
          label="Estilo do resumo"
          value={summaryStyle}
          onChange={(e) => onSummaryStyleChange(e.target.value)}
          options={STYLE_OPTIONS}
        />
        <Input
          label="Horario do digest"
          type="time"
          value={digestTime}
          onChange={(e) => onDigestTimeChange(e.target.value)}
        />
        <Input
          label="Max artigos"
          type="number"
          value={maxArticles}
          onChange={(e) => onMaxArticlesChange(Math.min(50, Math.max(5, parseInt(e.target.value) || 20)))}
          min={5}
          max={50}
        />
      </div>

      <ChipInput
        label="Exclusoes (termos para ignorar)"
        values={exclusions}
        onChange={onExclusionsChange}
        placeholder="spam, clickbait..."
      />
    </div>
  );
}
