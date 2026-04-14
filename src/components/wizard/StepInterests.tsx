"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { ChipInput } from "@/components/ui/ChipInput";

const EMOJI_OPTIONS = ["📰", "💰", "🏆", "💻", "🌍", "📊", "🎯", "🔬", "📈", "⚽", "🎬", "🍔"];
const COLOR_OPTIONS = [
  { value: "#007AFF", label: "Azul" },
  { value: "#5856D6", label: "Roxo" },
  { value: "#FF9500", label: "Laranja" },
  { value: "#34C759", label: "Verde" },
  { value: "#FF3B30", label: "Vermelho" },
  { value: "#AF8F3E", label: "Dourado" },
];

interface StepInterestsProps {
  name: string;
  icon: string;
  color: string;
  interests: string[];
  onNameChange: (name: string) => void;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
  onInterestsChange: (interests: string[]) => void;
}

export function StepInterests({
  name, icon, color, interests,
  onNameChange, onIconChange, onColorChange, onInterestsChange,
}: StepInterestsProps) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  async function handleSuggest() {
    if (!name.trim() || suggesting) return;
    setSuggesting(true);
    try {
      const res = await fetch("/api/suggest-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      const topics: string[] = Array.isArray(data.topics) ? data.topics : [];
      // Filter out ones already added
      const fresh = topics.filter((t) => !interests.some((i) => i.toLowerCase() === t.toLowerCase()));
      setSuggestions(fresh);
    } finally {
      setSuggesting(false);
    }
  }

  function addSuggestion(topic: string) {
    if (!interests.some((i) => i.toLowerCase() === topic.toLowerCase())) {
      onInterestsChange([...interests, topic]);
    }
    setSuggestions((prev) => prev.filter((s) => s !== topic));
  }

  return (
    <div className="flex flex-col gap-8 max-w-xl mx-auto">
      <div>
        <h2 className="text-[22px] font-bold mb-1 tracking-tight">Crie seu digest</h2>
        <p className="text-text-secondary text-[14px]">
          Escolha um nome e personalize a aparencia.
        </p>
      </div>

      <Input
        label="Nome"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Ex: Trading, Tech, Mundo"
        required
      />

      <div className="flex gap-10 flex-wrap">
        <div>
          <label className="text-[13px] text-text-secondary font-medium mb-2.5 block">Icone</label>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onIconChange(emoji)}
                className={`w-10 h-10 rounded-[10px] text-xl flex items-center justify-center transition-all duration-200 ${
                  icon === emoji
                    ? "bg-primary/15 ring-2 ring-primary scale-105"
                    : "bg-surface hover:bg-surface-light"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[13px] text-text-secondary font-medium mb-2.5 block">Cor</label>
          <div className="flex flex-wrap gap-2.5">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => onColorChange(c.value)}
                title={c.label}
                className={`w-8 h-8 rounded-full transition-all duration-200 ${
                  color === c.value
                    ? "ring-2 ring-text ring-offset-2 ring-offset-background scale-110"
                    : "hover:scale-105"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[22px] font-bold tracking-tight">Interesses</h2>
          <button
            type="button"
            onClick={handleSuggest}
            disabled={!name.trim() || suggesting}
            className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Sugerir com IA
          </button>
        </div>
        <p className="text-text-secondary text-[14px] mb-4">
          Cada interesse vira uma categoria. Adicione pelo menos um.
        </p>
        <ChipInput
          values={interests}
          onChange={onInterestsChange}
          placeholder="empreendedorismo, IA, day trade..."
        />

        {suggestions.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
              Sugestões baseadas em &quot;{name}&quot;
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addSuggestion(t)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] bg-surface hover:bg-primary hover:text-white transition-colors border border-border"
                >
                  + {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
