"use client";

import { Input } from "@/components/ui/Input";
import { ChipInput } from "@/components/ui/ChipInput";

const EMOJI_OPTIONS = ["📰", "💰", "🏆", "💻", "🌍", "📊", "🎯", "🔬", "📈", "⚽", "🎬", "🍔"];
const COLOR_OPTIONS = [
  { value: "#fb830e", label: "Laranja" },
  { value: "#08a6ff", label: "Azul" },
  { value: "#75f94c", label: "Verde" },
  { value: "#f54336", label: "Vermelho" },
  { value: "#c0b662", label: "Dourado" },
  { value: "#a855f7", label: "Roxo" },
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
  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-xl font-bold mb-1">Como vai se chamar seu digest?</h2>
        <p className="text-text-secondary text-sm mb-4">
          Escolha um nome, icone e cor para identificar este digest nas suas abas.
        </p>
        <Input
          label="Nome do Digest"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Ex: Trading, Tech News, Politica"
          required
        />
      </div>

      <div className="flex gap-8 flex-wrap">
        <div>
          <label className="text-sm text-text-secondary font-medium mb-2 block">Icone</label>
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onIconChange(emoji)}
                className={`w-10 h-10 rounded-md text-xl flex items-center justify-center transition-all ${
                  icon === emoji
                    ? "bg-primary/20 ring-2 ring-primary"
                    : "bg-surface hover:bg-surface-light"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-text-secondary font-medium mb-2 block">Cor</label>
          <div className="flex flex-wrap gap-3">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => onColorChange(c.value)}
                title={c.label}
                className={`w-9 h-9 rounded-full transition-all ${
                  color === c.value
                    ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-110"
                    : "hover:scale-105"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-1">Quais seus interesses?</h2>
        <p className="text-text-secondary text-sm mb-4">
          Cada interesse vira uma categoria no seu digest. Adicione pelo menos um.
        </p>
        <ChipInput
          label="Interesses"
          values={interests}
          onChange={onInterestsChange}
          placeholder="empreendedorismo, IA, day trade..."
        />
      </div>
    </div>
  );
}
