"use client";

import { relativeDate } from "@/lib/utils/relative-date";
import type { Digest } from "@/types";

interface DigestDateSelectorProps {
  digests: Digest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DigestDateSelector({ digests, selectedId, onSelect }: DigestDateSelectorProps) {
  if (digests.length <= 1) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto py-2 no-scrollbar">
      {digests.map((digest) => {
        const isSelected = digest.id === selectedId;
        return (
          <button
            key={digest.id}
            onClick={() => onSelect(digest.id)}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-all duration-200 ${
              isSelected
                ? "bg-text text-background"
                : "text-text-secondary hover:bg-surface"
            }`}
          >
            {relativeDate(digest.generated_at) || new Date(digest.generated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </button>
        );
      })}
    </div>
  );
}
