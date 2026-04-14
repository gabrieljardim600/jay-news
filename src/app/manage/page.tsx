"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Play, Pencil, Trash2, ChevronDown, Plus,
  CheckCircle2, XCircle, Clock, TrendingUp, AlertCircle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { relativeDate } from "@/lib/utils/relative-date";
import { useGeneration } from "@/context/GenerationContext";
import type { DigestConfig, Digest } from "@/types";

interface ConfigWithRuns {
  config: DigestConfig;
  digests: Digest[];
  loadingDigests: boolean;
}

// ── Trends creation modal ─────────────────────────────────────────────
function TrendsModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (topic: string, keywords: string) => Promise<void>;
}) {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setSaving(true);
    try {
      await onCreate(topic.trim(), keywords.trim());
      setTopic("");
      setKeywords("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo Digest Trends">
      <p className="text-[13px] text-text-secondary mb-4 leading-relaxed">
        Um digest focado num único tema — buscando cobertura profunda de várias fontes. Ideal para acompanhar uma tendência, lançamento ou assunto específico.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Tema principal"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Ex: Novas funcionalidades do Claude AI"
          required
        />
        <Input
          label="Palavras-chave extras (opcional)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="Ex: Anthropic, modelos de linguagem, LLM"
        />
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            Criar Trends
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Digest run row ────────────────────────────────────────────────────
function DigestRunRow({ digest, onClick }: { digest: Digest; onClick: () => void }) {
  const meta = digest.metadata || {};
  const isOk = digest.status === "completed";
  const isFail = digest.status === "failed";
  const isProcessing = digest.status === "processing";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2 px-3 rounded-[9px] hover:bg-surface transition-colors text-left group"
    >
      <div className="shrink-0">
        {isOk && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--color-success)" }} />}
        {isFail && <XCircle className="w-3.5 h-3.5" style={{ color: "var(--color-danger)" }} />}
        {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--color-primary)" }} />}
      </div>

      <span className="text-[12px] text-text-muted shrink-0">
        {new Date(digest.generated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
      </span>

      <div className="flex-1 min-w-0">
        {isOk && (
          <span className="text-[12px] text-text-secondary">
            {meta.total_articles ?? "—"} artigos · {meta.sources_count ?? "—"} fontes
          </span>
        )}
        {isFail && (
          <span className="text-[12px] truncate" style={{ color: "var(--color-danger)" }}>
            {meta.error ? meta.error.slice(0, 60) : "Falha na geração"}
          </span>
        )}
        {isProcessing && (
          <span className="text-[12px] text-text-muted">
            {meta.stage || "Processando..."}
          </span>
        )}
      </div>

      <span
        className="text-[11px] shrink-0 group-hover:underline"
        style={{ color: "var(--color-primary)" }}
      >
        Ver
      </span>
    </button>
  );
}

// ── Config card ───────────────────────────────────────────────────────
function ConfigCard({
  data,
  onRun,
  onDelete,
  onViewDigest,
}: {
  data: ConfigWithRuns;
  onRun: () => void;
  onDelete: () => void;
  onViewDigest: (digestId: string) => void;
}) {
  const [showRuns, setShowRuns] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const router = useRouter();
  const { genState } = useGeneration();

  const { config, digests, loadingDigests } = data;
  const lastDigest = digests[0] ?? null;
  const meta = lastDigest?.metadata ?? {};
  const isTrends = config.digest_type === "trends";
  const isThisRunning =
    genState.status === "generating" && genState.configId === config.id;

  const statusLine = () => {
    if (!lastDigest) return null;
    if (lastDigest.status === "processing")
      return (
        <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--color-primary)" }}>
          <Loader2 className="w-3 h-3 animate-spin" /> Gerando...
        </span>
      );
    if (lastDigest.status === "failed")
      return (
        <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--color-danger)" }}>
          <AlertCircle className="w-3 h-3 shrink-0" />
          {meta.error ? meta.error.slice(0, 60) : "Falhou na última execução"}
        </span>
      );
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-text-secondary">
        <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: "var(--color-success)" }} />
        {meta.total_articles ?? "—"} artigos · {meta.sources_count ?? "—"} fontes
      </span>
    );
  };

  return (
    <div
      className="rounded-[16px] border overflow-hidden"
      style={{ background: "var(--color-card)", borderColor: "var(--color-border)" }}
    >
      {/* Card header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-2xl shrink-0">{config.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[17px] font-bold tracking-tight truncate">{config.name}</h2>
                {isTrends && (
                  <span
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "var(--color-secondary)20", color: "var(--color-secondary)" }}
                  >
                    <TrendingUp className="w-2.5 h-2.5" />
                    TRENDS
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span
                  className="flex items-center gap-1 text-[11px] font-medium"
                  style={{ color: config.is_active ? "var(--color-success)" : "var(--color-text-muted)" }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: config.is_active ? "var(--color-success)" : "var(--color-text-muted)" }}
                  />
                  {config.is_active ? "Ativo" : "Inativo"}
                </span>
                <span className="text-text-muted text-[11px]">·</span>
                <span className="text-[11px] text-text-muted flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {config.digest_time}
                </span>
                <span className="text-text-muted text-[11px]">·</span>
                <span className="text-[11px] text-text-muted">
                  {config.language === "pt-BR" ? "PT-BR" : config.language}
                </span>
                <span className="text-text-muted text-[11px]">·</span>
                <span className="text-[11px] text-text-muted">{config.max_articles} art max</span>
              </div>
            </div>
          </div>
        </div>

        {/* Last run summary */}
        <div
          className="rounded-[10px] p-3 mb-3"
          style={{ background: "var(--color-surface)" }}
        >
          {!lastDigest && !loadingDigests && (
            <p className="text-[12px] text-text-muted">Nenhuma execução ainda.</p>
          )}
          {loadingDigests && (
            <p className="text-[12px] text-text-muted">Carregando...</p>
          )}
          {lastDigest && (
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-text-muted">Última execução</span>
                <span className="text-[12px] text-text-secondary font-medium">
                  {relativeDate(lastDigest.generated_at)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 items-end">
                {statusLine()}
              </div>
            </div>
          )}
        </div>

        {/* Source results from last run */}
        {lastDigest?.status === "completed" && (meta.source_results?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(meta.source_results ?? []).slice(0, 6).map((sr, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{
                  background: sr.status === "ok"
                    ? "var(--color-success)15"
                    : sr.status === "error"
                    ? "var(--color-danger)15"
                    : "var(--color-surface-light)",
                  color: sr.status === "ok"
                    ? "var(--color-success)"
                    : sr.status === "error"
                    ? "var(--color-danger)"
                    : "var(--color-text-muted)",
                }}
              >
                {sr.name}
                {sr.status === "ok" && ` · ${sr.count}`}
              </span>
            ))}
          </div>
        )}

        {/* Error detail */}
        {lastDigest?.status === "failed" && meta.error && (
          <div
            className="rounded-[10px] p-3 mb-3 text-[12px] leading-relaxed"
            style={{ background: "var(--color-danger)10", color: "var(--color-danger)" }}
          >
            <span className="font-semibold">Erro: </span>{meta.error.slice(0, 200)}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={onRun}
            disabled={isThisRunning || genState.status === "generating"}
            loading={isThisRunning}
            className="rounded-full"
          >
            <Play className="w-3 h-3 mr-1" />
            {isThisRunning ? "Gerando..." : "Rodar"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/settings?configId=${config.id}`)}
            className="rounded-full"
          >
            <Pencil className="w-3 h-3 mr-1" />
            Editar
          </Button>
          {deleteConfirm ? (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[12px] text-text-muted">Confirmar?</span>
              <button
                onClick={onDelete}
                className="text-[12px] font-medium px-2.5 py-1 rounded-full transition-colors"
                style={{ background: "var(--color-danger)15", color: "var(--color-danger)" }}
              >
                Sim, deletar
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="text-[12px] text-text-muted hover:text-text px-1.5"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="ml-auto w-7 h-7 flex items-center justify-center rounded-full hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Recent runs toggle */}
      {digests.length > 0 && (
        <div
          className="border-t"
          style={{ borderColor: "var(--color-border)" }}
        >
          <button
            type="button"
            onClick={() => setShowRuns(!showRuns)}
            className="w-full flex items-center justify-between px-5 py-3 text-[12px] text-text-muted hover:text-text transition-colors"
          >
            <span>Últimas {digests.length} execuções</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${showRuns ? "rotate-180" : ""}`}
            />
          </button>
          {showRuns && (
            <div className="px-3 pb-3 flex flex-col gap-0.5">
              {digests.map((d) => (
                <DigestRunRow key={d.id} digest={d} onClick={() => onViewDigest(d.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function ManagePage() {
  const [items, setItems] = useState<ConfigWithRuns[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendsModalOpen, setTrendsModalOpen] = useState(false);
  const router = useRouter();
  const { startGeneration } = useGeneration();

  const loadAll = useCallback(async () => {
    const configsRes = await fetch("/api/digest-configs");
    if (!configsRes.ok) { setLoading(false); return; }
    const configs: DigestConfig[] = await configsRes.json();
    if (!Array.isArray(configs)) { setLoading(false); return; }

    // Initialize items with loading state
    const initial: ConfigWithRuns[] = configs.map((config) => ({
      config,
      digests: [],
      loadingDigests: true,
    }));
    setItems(initial);
    setLoading(false);

    // Load recent digests per config in parallel
    await Promise.all(
      configs.map(async (config, idx) => {
        const res = await fetch(`/api/digests?digestConfigId=${config.id}&limit=5`);
        const digests: Digest[] = res.ok ? await res.json() : [];
        setItems((prev) =>
          prev.map((item, i) =>
            i === idx ? { ...item, digests: Array.isArray(digests) ? digests : [], loadingDigests: false } : item
          )
        );
      })
    );
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleRun(configId: string) {
    await startGeneration(configId);
    router.push("/");
  }

  async function handleDelete(configId: string) {
    await fetch(`/api/digest-configs?id=${configId}`, { method: "DELETE" });
    loadAll();
  }

  function handleViewDigest(digestId: string) {
    router.push(`/?digestId=${digestId}`);
  }

  async function handleCreateTrends(topic: string, keywordsRaw: string) {
    const keywords = keywordsRaw
      ? keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean)
      : [];

    const res = await fetch("/api/digest-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: topic.length > 30 ? topic.slice(0, 28) + "…" : topic,
        icon: "📈",
        color: "#5856D6",
        digest_type: "trends",
        trend_topic: topic,
        trend_keywords: keywords.length > 0 ? keywords : undefined,
        language: "pt-BR",
        summary_style: "detailed",
        digest_time: "07:00",
        max_articles: 25,
      }),
    });

    if (res.ok) {
      setTrendsModalOpen(false);
      await loadAll();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--color-primary)" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-10 pb-28">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-secondary"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
          </button>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">Meus Digests</h1>
            <p className="text-[12px] text-text-muted">{items.length} digest{items.length !== 1 ? "s" : ""} configurado{items.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTrendsModalOpen(true)}
            className="rounded-full"
          >
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            Novo Trends
          </Button>
          <Button
            size="sm"
            onClick={() => router.push("/wizard")}
            className="rounded-full"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo digest
          </Button>
        </div>
      </header>

      {/* Configs list */}
      {items.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
            <span className="text-2xl">📭</span>
          </div>
          <p className="text-text-secondary text-[17px] font-medium mb-1">Nenhum digest ainda</p>
          <p className="text-text-muted text-[14px] mb-6">Crie seu primeiro digest para começar.</p>
          <Button onClick={() => router.push("/wizard")} className="rounded-full px-6">
            <Plus className="w-4 h-4 mr-2" />
            Criar digest
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <ConfigCard
              key={item.config.id}
              data={item}
              onRun={() => handleRun(item.config.id)}
              onDelete={() => handleDelete(item.config.id)}
              onViewDigest={handleViewDigest}
            />
          ))}
        </div>
      )}

      <TrendsModal
        open={trendsModalOpen}
        onClose={() => setTrendsModalOpen(false)}
        onCreate={handleCreateTrends}
      />
    </div>
  );
}
