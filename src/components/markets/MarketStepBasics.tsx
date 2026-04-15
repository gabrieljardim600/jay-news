"use client";

import { Input } from "@/components/ui/Input";

const EMOJI_OPTIONS = ["📊", "💰", "💳", "📈", "🏦", "🛒", "🚀", "🧠", "🏥", "🏗️", "⚽", "🎮"];
const COLOR_OPTIONS = [
  { value: "#007AFF", label: "Azul" },
  { value: "#5856D6", label: "Roxo" },
  { value: "#FF9500", label: "Laranja" },
  { value: "#34C759", label: "Verde" },
  { value: "#FF3B30", label: "Vermelho" },
  { value: "#AF8F3E", label: "Dourado" },
];

interface Props {
  name: string;
  description: string;
  icon: string;
  color: string;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onIconChange: (v: string) => void;
  onColorChange: (v: string) => void;
}

export function MarketStepBasics({ name, description, icon, color, onNameChange, onDescriptionChange, onIconChange, onColorChange }: Props) {
  return (
    <div className="flex flex-col gap-8 max-w-xl mx-auto">
      <div>
        <h2 className="text-[22px] font-bold mb-1 tracking-tight">Acompanhar mercado</h2>
        <p className="text-text-secondary text-[14px]">
          Defina o mercado que você quer monitorar — notícias, movimentos e concorrentes.
        </p>
      </div>

      <Input
        label="Nome do mercado"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Ex: Subadquirência & Meios de Pagamento"
        required
      />

      <div>
        <label className="text-[13px] text-text-secondary font-medium mb-2 block">Descrição curta (opcional)</label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Contexto que ajude a IA a direcionar as buscas"
          rows={2}
          className="w-full rounded-[10px] bg-surface border border-border px-3 py-2.5 text-[14px] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
        />
      </div>

      <div className="flex gap-10 flex-wrap">
        <div>
          <label className="text-[13px] text-text-secondary font-medium mb-2.5 block">Ícone</label>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onIconChange(emoji)}
                className={`w-10 h-10 rounded-[10px] text-xl flex items-center justify-center transition-all duration-200 ${
                  icon === emoji ? "bg-primary/15 ring-2 ring-primary scale-105" : "bg-surface hover:bg-surface-light"
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
                  color === c.value ? "ring-2 ring-text ring-offset-2 ring-offset-background scale-110" : "hover:scale-105"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
