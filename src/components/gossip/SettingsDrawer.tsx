"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { SourceFormModal } from "./SourceFormModal";
import { TopicFormModal } from "./TopicFormModal";
import type { GossipSource, GossipTopic } from "@/lib/gossip/types";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  sources: GossipSource[];
  topics: GossipTopic[];
  onSourcesChange: () => void;
  onTopicsChange: () => void;
  initialTab?: Tab;
}

type Tab = "sources" | "topics";

const PLATFORM_LABEL: Record<string, string> = {
  rss: "RSS",
  twitter: "Twitter",
  youtube: "YouTube",
  reddit: "Reddit",
};

const TYPE_LABEL: Record<string, string> = {
  person: "Pessoa",
  couple: "Casal",
  event: "Evento",
  show: "Show",
  brand: "Marca",
};

export function SettingsDrawer({
  open,
  onClose,
  sources,
  topics,
  onSourcesChange,
  onTopicsChange,
  initialTab,
}: SettingsDrawerProps) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "sources");
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<GossipSource | undefined>();
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<GossipTopic | undefined>();

  useEffect(() => {
    if (open && initialTab) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  async function toggleSourceActive(src: GossipSource) {
    const res = await fetch(`/api/gossip/sources/${src.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !src.active }),
    });
    if (res.ok) onSourcesChange();
    else alert("Erro ao atualizar fonte");
  }

  async function deleteSource(id: string) {
    if (!confirm("Remover esta fonte?")) return;
    const res = await fetch(`/api/gossip/sources/${id}`, { method: "DELETE" });
    if (res.ok) onSourcesChange();
    else alert("Erro ao remover fonte");
  }

  async function deleteTopic(id: string) {
    if (!confirm("Remover este topic?")) return;
    const res = await fetch(`/api/gossip/topics/${id}`, { method: "DELETE" });
    if (res.ok) onTopicsChange();
    else alert("Erro ao remover topic");
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md bg-card-solid border-l border-border shadow-2xl transition-transform duration-200 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-[17px] font-semibold">Configurações do Gossip</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface hover:bg-surface-light text-text-muted hover:text-text transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-4 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-border">
            <TabButton active={tab === "sources"} onClick={() => setTab("sources")} label="Fontes" />
            <TabButton active={tab === "topics"} onClick={() => setTab("topics")} label="Topics" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "sources" ? (
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] text-text-muted">
                  {sources.length} fonte(s) cadastrada(s)
                </p>
                <button
                  onClick={() => {
                    setEditingSource(undefined);
                    setSourceModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 text-[13px] text-primary font-medium hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar fonte
                </button>
              </div>

              {sources.length === 0 && (
                <p className="text-text-muted text-[13px] py-4">Nenhuma fonte ainda.</p>
              )}

              <div className="flex flex-col gap-1.5">
                {sources.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-[10px] bg-surface"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium truncate">{s.label}</span>
                        <span className="text-[10px] text-text-muted uppercase tracking-wide">
                          {PLATFORM_LABEL[s.platform] ?? s.platform}
                        </span>
                      </div>
                      <span className="text-[11px] text-text-muted truncate">{s.handle}</span>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => toggleSourceActive(s)}
                        className={`h-6 px-2 rounded-full text-[10px] font-medium uppercase tracking-wide transition-colors ${
                          s.active
                            ? "bg-primary/10 text-primary"
                            : "bg-surface-light text-text-muted"
                        }`}
                        title={s.active ? "Ativa — clique para desativar" : "Inativa — clique para ativar"}
                      >
                        {s.active ? "on" : "off"}
                      </button>
                      <button
                        onClick={() => {
                          setEditingSource(s);
                          setSourceModalOpen(true);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-light text-text-muted hover:text-text transition-colors"
                        aria-label="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteSource(s.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
                        aria-label="Remover"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] text-text-muted">
                  {topics.length} topic(s) cadastrado(s)
                </p>
                <button
                  onClick={() => {
                    setEditingTopic(undefined);
                    setTopicModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 text-[13px] text-primary font-medium hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar topic
                </button>
              </div>

              {topics.length === 0 && (
                <p className="text-text-muted text-[13px] py-4">Nenhum topic ainda.</p>
              )}

              <div className="flex flex-col gap-1.5">
                {topics.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-[10px] bg-surface"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium truncate">{t.name}</span>
                        <span className="text-[10px] text-text-muted uppercase tracking-wide">
                          {TYPE_LABEL[t.type] ?? t.type}
                        </span>
                      </div>
                      {t.aliases.length > 0 && (
                        <span className="text-[11px] text-text-muted truncate">
                          {t.aliases.join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditingTopic(t);
                          setTopicModalOpen(true);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-light text-text-muted hover:text-text transition-colors"
                        aria-label="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteTopic(t.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
                        aria-label="Remover"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>

      <SourceFormModal
        open={sourceModalOpen}
        onClose={() => {
          setSourceModalOpen(false);
          setEditingSource(undefined);
        }}
        onSaved={onSourcesChange}
        existing={editingSource}
      />
      <TopicFormModal
        open={topicModalOpen}
        onClose={() => {
          setTopicModalOpen(false);
          setEditingTopic(undefined);
        }}
        onSaved={onTopicsChange}
        existing={editingTopic}
      />
    </>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium transition-all duration-200 ${
        active ? "bg-text text-background shadow-sm" : "text-text-muted hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}
