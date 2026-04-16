"use client";

import { Sparkles, Layers, History } from "lucide-react";
import { useAskJay } from "@/context/AskJayContext";
import { buildQuickActionMessage } from "@/lib/jay-brain/prompts";
import type { Article, QuickActionVariant } from "@/types";

interface QuickActionsProps {
  article: Pick<Article, "id" | "title" | "summary" | "full_content" | "source_name" | "source_url" | "published_at">;
  size?: "sm" | "md";
}

const ACTIONS: { variant: QuickActionVariant; label: string; icon: typeof Sparkles }[] = [
  { variant: "deepen", label: "Aprofundar", icon: Sparkles },
  { variant: "impact", label: "Impacto", icon: Layers },
  { variant: "history", label: "Histórico", icon: History },
];

export function QuickActions({ article, size = "md" }: QuickActionsProps) {
  const askJay = useAskJay();

  function handleClick(variant: QuickActionVariant) {
    const preloaded = buildQuickActionMessage(variant, article.title);
    askJay.open({
      type: "article",
      id: article.id,
      article,
      preloadedMessage: preloaded,
    });
    // Fire-and-forget interaction log
    fetch("/api/jay-brain/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "quick_action",
        target_type: "article",
        target_id: article.id,
        payload: { variant },
      }),
    }).catch(() => {});
  }

  const heightCls = size === "sm" ? "h-7 px-2.5 text-[11px]" : "h-8 px-3 text-[12px]";
  const iconCls = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <div className="flex flex-wrap gap-1.5">
      {ACTIONS.map(({ variant, label, icon: Icon }) => (
        <button
          key={variant}
          type="button"
          onClick={() => handleClick(variant)}
          className={`inline-flex items-center gap-1.5 ${heightCls} rounded-full bg-surface hover:bg-surface-light text-text-secondary hover:text-text transition-colors font-medium`}
        >
          <Icon className={iconCls} />
          {label}
        </button>
      ))}
    </div>
  );
}
