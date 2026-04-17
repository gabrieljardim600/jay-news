"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { DossierCard } from "./DossierCard";
import type { GossipDossier, GossipTopic } from "@/lib/gossip/types";

interface DossierRow {
  topic: GossipTopic;
  dossier: GossipDossier | null;
}

interface DossierGridProps {
  refreshKey: number;
  onAddTopic?: () => void;
}

export function DossierGrid({ refreshKey, onAddTopic }: DossierGridProps) {
  const [rows, setRows] = useState<DossierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gossip/dossiers");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setRows(Array.isArray(data) ? (data as DossierRow[]) : []);
    } catch (err) {
      setError((err as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  function handleRefreshed(topicId: string, dossier: GossipDossier | null) {
    setRows((prev) =>
      prev.map((r) => (r.topic.id === topicId ? { ...r, dossier } : r))
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="rounded-[14px] border border-border p-4 flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-surface-light animate-pulse shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-3 w-24 bg-surface-light animate-pulse rounded mb-2" />
                <div className="h-2.5 w-16 bg-surface-light animate-pulse rounded" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="h-2.5 w-full bg-surface-light animate-pulse rounded" />
              <div className="h-2.5 w-5/6 bg-surface-light animate-pulse rounded" />
              <div className="h-2.5 w-4/5 bg-surface-light animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-[13px] text-danger">Erro ao carregar dossiês: {error}</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[14px] border border-dashed border-border p-6 bg-card-solid">
        <p className="text-[13px] text-text-muted">
          Nenhum topic cadastrado — adicione pessoas, casais ou eventos para começar a receber dossiês diários.
        </p>
        {onAddTopic && (
          <button
            onClick={onAddTopic}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Adicione topics
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {rows.map((r) => (
        <DossierCard
          key={r.topic.id}
          topic={r.topic}
          dossier={r.dossier}
          onRefreshed={(d) => handleRefreshed(r.topic.id, d)}
        />
      ))}
    </div>
  );
}
