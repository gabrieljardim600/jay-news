"use client";

import type { Digest } from "@/types";

interface DigestDateSelectorProps {
  digests: Digest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DigestDateSelector({ digests, selectedId, onSelect }: DigestDateSelectorProps) {
  if (digests.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto py-2 pb-3 no-scrollbar">
      {digests.map((digest) => (
        <button
          key={digest.id}
          onClick={() => onSelect(digest.id)}
          className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-all ${
            digest.id === selectedId
              ? "bg-primary text-white font-semibold"
              : "bg-surface text-text-secondary border border-border hover:border-primary/40 hover:text-text"
          }`}
        >
          {new Date(digest.generated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
        </button>
      ))}
    </div>
  );
}
