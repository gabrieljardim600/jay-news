"use client";

import { useRouter } from "next/navigation";
import type { DigestConfig } from "@/types";

interface DigestTabsProps {
  configs: DigestConfig[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function DigestTabs({ configs, activeId, onSelect }: DigestTabsProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-4 scrollbar-hide border-b border-border">
      {configs.map((config) => {
        const isActive = activeId === config.id;
        return (
          <button
            key={config.id}
            onClick={() => onSelect(config.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all border-b-[3px] -mb-px ${
              isActive
                ? "text-white border-current"
                : "text-text-muted border-transparent hover:text-text hover:border-border"
            }`}
            style={isActive ? { borderColor: config.color, color: config.color } : undefined}
          >
            <span>{config.icon}</span>
            <span>{config.name}</span>
          </button>
        );
      })}
      <button
        onClick={() => router.push("/wizard")}
        className="flex items-center px-3 py-2.5 text-sm text-text-muted hover:text-primary border-b-[3px] border-transparent -mb-px transition-all whitespace-nowrap"
        title="Novo digest"
      >
        + Novo
      </button>
    </div>
  );
}
