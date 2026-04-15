"use client";

import { ChipInput } from "@/components/ui/ChipInput";

interface Props {
  subtopics: string[];
  onChange: (v: string[]) => void;
}

export function MarketStepSubtopics({ subtopics, onChange }: Props) {
  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-[22px] font-bold mb-1 tracking-tight">Sub-tópicos</h2>
        <p className="text-text-secondary text-[14px]">
          Palavras-chave que direcionam as buscas — não separam visualmente, apenas aumentam a relevância do que é coletado.
        </p>
      </div>
      <ChipInput
        values={subtopics}
        onChange={onChange}
        placeholder="day trade, mini contratos, PIX, parcelamento..."
      />
      <p className="text-[12px] text-text-muted">
        Opcional — você pode pular e refinar depois.
      </p>
    </div>
  );
}
