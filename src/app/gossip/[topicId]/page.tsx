"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { AppHeader } from "@/components/ui/AppHeader";
import type { GossipDossier, GossipTopic, SpikeLevel } from "@/lib/gossip/types";

const TYPE_LABEL: Record<string, string> = {
  person: "Pessoa",
  couple: "Casal",
  event: "Evento",
  show: "Show",
  brand: "Marca",
};

function initial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase();
}

function spikeBadge(level: SpikeLevel | null | undefined) {
  if (level === "high") {
    return (
      <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-red-500/15 text-red-500">
        🔥 alta
      </span>
    );
  }
  if (level === "medium") {
    return (
      <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-yellow-500/15 text-yellow-500">
        📈 média
      </span>
    );
  }
  if (level === "low") {
    return (
      <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-surface text-text-muted">
        baixa
      </span>
    );
  }
  return null;
}

function formatDate(iso: string): string {
  // iso is "YYYY-MM-DD"
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  });
}

export default function TopicDetailPage() {
  const router = useRouter();
  const params = useParams<{ topicId: string }>();
  const topicId = params?.topicId;

  const [topic, setTopic] = useState<GossipTopic | null>(null);
  const [dossiers, setDossiers] = useState<GossipDossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: "info" | "success" | "error" } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadAll = useCallback(async () => {
    if (!topicId) return;
    setLoading(true);
    setError(null);
    try {
      const [topicRes, dossiersRes] = await Promise.all([
        fetch(`/api/gossip/topics/${topicId}`),
        fetch(`/api/gossip/topics/${topicId}/dossiers?limit=30`),
      ]);
      if (!topicRes.ok) {
        const j = await topicRes.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${topicRes.status}`);
      }
      if (!dossiersRes.ok) {
        const j = await dossiersRes.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${dossiersRes.status}`);
      }
      const topicData = (await topicRes.json()) as GossipTopic;
      const dossiersData = (await dossiersRes.json()) as GossipDossier[];
      setTopic(topicData);
      setDossiers(Array.isArray(dossiersData) ? dossiersData : []);
    } catch (err) {
      setError((err as Error).message);
      setTopic(null);
      setDossiers([]);
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleRefresh() {
    if (!topicId || refreshing) return;
    setRefreshing(true);
    setToast({ message: "Gerando dossiê de hoje...", kind: "info" });
    try {
      const res = await fetch(`/api/gossip/topics/${topicId}/refresh`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ message: `Erro: ${data?.error || `HTTP ${res.status}`}`, kind: "error" });
        return;
      }
      if (data?.dossier) {
        setToast({ message: "Dossiê atualizado", kind: "success" });
      } else {
        setToast({ message: "Sem posts novos hoje", kind: "info" });
      }
      // Recarrega timeline
      const dossiersRes = await fetch(`/api/gossip/topics/${topicId}/dossiers?limit=30`);
      if (dossiersRes.ok) {
        const dossiersData = (await dossiersRes.json()) as GossipDossier[];
        setDossiers(Array.isArray(dossiersData) ? dossiersData : []);
      }
    } catch (err) {
      setToast({ message: `Erro de rede: ${(err as Error).message}`, kind: "error" });
    } finally {
      setRefreshing(false);
    }
  }

  const lastDossierDate = useMemo(() => {
    if (dossiers.length === 0) return null;
    return dossiers[0]!.date;
  }, [dossiers]);

  const backBtn = (
    <button
      onClick={() => router.push("/gossip")}
      aria-label="Voltar"
      title="Voltar para Gossip"
      className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-muted hover:text-text"
    >
      <ArrowLeft className="w-[18px] h-[18px]" />
    </button>
  );

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8 pb-20">
      <AppHeader rightSlot={backBtn} />

      {loading ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-surface-light animate-pulse shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-5 w-48 bg-surface-light animate-pulse rounded" />
              <div className="h-3 w-32 bg-surface-light animate-pulse rounded" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[14px] border border-border p-4">
                <div className="h-3 w-24 bg-surface-light animate-pulse rounded mb-3" />
                <div className="space-y-2">
                  <div className="h-3 w-full bg-surface-light animate-pulse rounded" />
                  <div className="h-3 w-5/6 bg-surface-light animate-pulse rounded" />
                  <div className="h-3 w-4/5 bg-surface-light animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <p className="text-[13px] text-danger py-6">Erro: {error}</p>
      ) : !topic ? (
        <p className="text-[13px] text-text-muted py-6">Topic não encontrado.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-surface shrink-0 relative flex items-center justify-center text-text-secondary text-2xl font-semibold">
              {topic.image_url ? (
                <Image
                  src={topic.image_url}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span>{initial(topic.name)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-[22px] font-bold font-heading tracking-tight truncate">
                  {topic.name}
                </h1>
                <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-surface text-text-muted uppercase tracking-wide">
                  {TYPE_LABEL[topic.type] ?? topic.type}
                </span>
              </div>
              {topic.aliases.length > 0 && (
                <p className="text-[12px] text-text-muted mb-2">
                  {topic.aliases.join(", ")}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap text-[11px] text-text-muted">
                <span className="inline-flex items-center h-5 px-2 rounded-full bg-surface">
                  prioridade {topic.priority}
                </span>
                {lastDossierDate && (
                  <span>Último dossiê: {formatDate(lastDossierDate)}</span>
                )}
              </div>
            </div>
          </section>

          <div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`h-9 px-4 flex items-center gap-2 rounded-full text-[13px] font-medium transition-all duration-200 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed ${
                refreshing ? "bg-surface text-text-muted" : "bg-primary text-white hover:bg-primary-hover shadow-sm"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin opacity-60" : ""}`} />
              {refreshing ? "Gerando..." : "Atualizar dossiê de hoje"}
            </button>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold">Timeline</h2>
            {dossiers.length === 0 ? (
              <p className="text-[13px] text-text-muted py-6">
                Ainda não há dossiês para este topic.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {dossiers.map((d) => {
                  const isOpen = expanded === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : d.id)}
                      className="text-left rounded-[14px] border border-border bg-card-solid hover:border-primary/40 transition-colors p-4 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold">{formatDate(d.date)}</span>
                          {spikeBadge(d.spike_level)}
                        </div>
                        <span className="text-[11px] text-text-muted">
                          {isOpen ? "fechar" : "expandir"}
                        </span>
                      </div>
                      <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-line">
                        {d.summary}
                      </p>
                      {isOpen && d.key_quotes && d.key_quotes.length > 0 && (
                        <div className="mt-2 flex flex-col gap-2 pt-3 border-t border-border">
                          {d.key_quotes.map((q, idx) => (
                            <div key={idx} className="flex flex-col gap-1">
                              <p className="text-[12px] text-text leading-relaxed">
                                &ldquo;{q.text}&rdquo;
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-text-muted">
                                <span>— {q.source_label}</span>
                                {q.url && (
                                  <a
                                    href={q.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-0.5 text-primary hover:underline"
                                  >
                                    abrir <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface border rounded-full px-4 py-2 shadow-lg text-[13px] font-medium ${
            toast.kind === "success"
              ? "border-primary/40 text-primary"
              : toast.kind === "error"
              ? "border-danger/40 text-danger"
              : "border-border text-text"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
