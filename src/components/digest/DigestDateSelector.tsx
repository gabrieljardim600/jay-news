"use client";

import { Button } from "@/components/ui/Button";
import type { Digest } from "@/types";

interface DigestDateSelectorProps {
  digests: Digest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DigestDateSelector({ digests, selectedId, onSelect }: DigestDateSelectorProps) {
  if (digests.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {digests.map((digest) => (
        <Button
          key={digest.id}
          variant={digest.id === selectedId ? "primary" : "outline"}
          size="sm"
          onClick={() => onSelect(digest.id)}
        >
          {new Date(digest.generated_at).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
          })}
        </Button>
      ))}
    </div>
  );
}
