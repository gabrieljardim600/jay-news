"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { GossipDossier, GossipTopic, SpikeLevel } from "@/lib/gossip/types";

interface DossierCardProps {
  topic: GossipTopic;
  dossier: GossipDossier | null;
  onRefreshed: (d: GossipDossier | null) => void;
}

function initial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase();
}

function relativeDateLabel(dateStr: string): string | null {
  const today = new Date().toISOString().slice(0, 10);
  if (dateStr === today) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  const diffDays = Math.round(
    (now.getTime() - d.getTime()) / (24 * 3600_000)
  );
  if (diffDays === 1) return "ontem";
  if (diffDays > 1 && diffDays <= 7) return `há ${diffDays} dias`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function spikeBadge(level: SpikeLevel | null | undefined) {
  if (level === "high") {
    return (
      <span
        className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-red-500/15 text-red-500"
        title="Alta atividade nas últimas 24h"
      >
        🔥 alta
      </span>
    );
  }
  if (level === "medium") {
    return (
      <span
        className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-yellow-500/15 text-yellow-500"
        title="Atividade acima da média"
      >
        📈 média
      </span>
    );
  }
  return null;
}

export function DossierCard({ topic, dossier, onRefreshed }: DossierCardProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const summary = dossier?.summary ?? `Sem novidade recente sobre ${topic.name}. Clique em atualizar pra buscar.`;
  const staleLabel = dossier ? relativeDateLabel(dossier.date) : null;

  async function handleRefresh(e: React.MouseEvent) {
    e.stopPropagation();
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/gossip/topics/${topic.id}/refresh`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Erro: ${data?.error || `HTTP ${res.status}`}`);
        return;
      }
      onRefreshed((data?.dossier ?? null) as GossipDossier | null);
    } catch (err) {
      alert(`Erro de rede: ${(err as Error).message}`);
    } finally {
      setRefreshing(false);
    }
  }

  function handleCardClick() {
    router.push(`/gossip/${topic.id}`);
  }

  return (
    <button
      type="button"
      onClick={handleCardClick}
      className="text-left w-full flex flex-col gap-3 p-4 rounded-[14px] border border-border bg-card-solid hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-surface shrink-0 relative flex items-center justify-center text-text-secondary text-lg font-semibold">
          {topic.image_url ? (
            <Image
              src={topic.image_url}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span>{initial(topic.name)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-semibold text-text truncate">{topic.name}</h3>
            {spikeBadge(dossier?.spike_level ?? null)}
            {staleLabel && (
              <span
                className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-surface text-text-muted"
                title={`Dossiê de ${dossier?.date}`}
              >
                {staleLabel}
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-muted capitalize">{topic.type}</p>
        </div>

        <span
          role="button"
          tabIndex={0}
          onClick={handleRefresh}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleRefresh(e as unknown as React.MouseEvent);
            }
          }}
          aria-label="Atualizar dossiê"
          title="Atualizar dossiê"
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface text-text-muted hover:text-text transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin opacity-60" : ""}`} />
        </span>
      </div>

      <p className="text-[13px] text-text-secondary leading-relaxed line-clamp-4 whitespace-pre-line">
        {summary}
      </p>
    </button>
  );
}
