"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { WatchlistItemModal } from "./WatchlistItemModal";
import type { WatchlistItem, WatchlistKind } from "@/types";

interface WatchlistListProps {
  items: WatchlistItem[];
  onRefresh: () => void;
}

const KIND_LABEL: Record<WatchlistKind, string> = {
  asset: "Ativo",
  theme: "Tema",
  person: "Pessoa",
  company: "Empresa",
};

const KIND_GROUPS: WatchlistKind[] = ["asset", "theme", "company", "person"];

export function WatchlistList({ items, onRefresh }: WatchlistListProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WatchlistItem | undefined>();
  const [loading, setLoading] = useState(false);

  async function handleSave(data: { kind: WatchlistKind; label: string; keywords: string[] }) {
    setLoading(true);
    try {
      if (editing) {
        await fetch("/api/watchlist", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...data }),
        });
      } else {
        await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
      setModalOpen(false);
      setEditing(undefined);
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/watchlist?id=${id}`, { method: "DELETE" });
    onRefresh();
  }

  const byKind: Record<WatchlistKind, WatchlistItem[]> = {
    asset: [],
    theme: [],
    person: [],
    company: [],
  };
  for (const it of items) byKind[it.kind].push(it);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold">Watchlist</h2>
          <p className="text-[12px] text-text-muted leading-tight">Ativos, temas, pessoas e empresas que o Jay vai acompanhar para você.</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setModalOpen(true); }}
          className="flex items-center gap-1.5 text-[13px] text-primary font-medium hover:underline"
        >
          <Plus className="w-3.5 h-3.5" /> Novo
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-text-muted text-[13px]">Nenhum item ainda. Adicione o que você acompanha no dia a dia.</p>
      )}

      <div className="flex flex-col gap-4">
        {KIND_GROUPS.map((kind) => {
          const group = byKind[kind];
          if (group.length === 0) return null;
          return (
            <div key={kind}>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-2">{KIND_LABEL[kind]}</h3>
              <div className="flex flex-col gap-1.5">
                {group.map((it) => (
                  <div key={it.id} className="flex items-center justify-between p-3 rounded-[10px] bg-surface">
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <span className="text-[14px] font-medium truncate">{it.label}</span>
                      {it.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {it.keywords.map((kw) => (
                            <span key={kw} className="text-[11px] bg-surface-light text-text-muted px-2 py-0.5 rounded-full">{kw}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => { setEditing(it); setModalOpen(true); }}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-light text-text-muted hover:text-text transition-colors"
                        aria-label="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(it.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
                        aria-label="Remover"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <WatchlistItemModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        onSave={handleSave}
        item={editing}
        loading={loading}
      />
    </Card>
  );
}
