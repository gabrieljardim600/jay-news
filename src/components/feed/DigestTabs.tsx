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
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mb-6">
      {configs.map((config) => {
        const isActive = activeId === config.id;
        return (
          <button
            key={config.id}
            onClick={() => onSelect(config.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[14px] font-medium whitespace-nowrap rounded-full transition-all duration-200 ${
              isActive
                ? "bg-text text-background"
                : "text-text-muted hover:text-text hover:bg-surface"
            }`}
          >
            <span>{config.icon}</span>
            <span>{config.name}</span>
          </button>
        );
      })}
      <button
        onClick={() => router.push("/wizard")}
        className="flex items-center px-3 py-2 text-[14px] text-text-muted hover:text-primary rounded-full hover:bg-surface transition-all duration-200 whitespace-nowrap"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mr-1">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Novo
      </button>
    </div>
  );
}
