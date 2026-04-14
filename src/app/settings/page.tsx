"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Play, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { TopicsList } from "@/components/settings/TopicsList";
import { SourcesList } from "@/components/settings/SourcesList";
import { AlertsList } from "@/components/settings/AlertsList";
import { AdvancedOptions } from "@/components/settings/AdvancedOptions";
import { TrendsEditor } from "@/components/settings/TrendsEditor";
import { TrendingUp } from "lucide-react";
import { useGeneration } from "@/context/GenerationContext";
import type { Topic, RssSource, Alert, Exclusion, DigestConfig, UserSettings } from "@/types";

function SettingsContent() {
  const [config, setConfig] = useState<DigestConfig | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sources, setSources] = useState<RssSource[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const configId = searchParams.get("configId");

  const { genState, startGeneration } = useGeneration();
  const isGenerating = genState.status === "generating";

  const loadData = useCallback(async () => {
    if (!configId) return;
    const [configsRes, topicsRes, sourcesRes, alertsRes, exclusionsRes] = await Promise.all([
      fetch("/api/digest-configs").then((r) => r.json()),
      fetch(`/api/topics?digestConfigId=${configId}`).then((r) => r.json()),
      fetch(`/api/sources?digestConfigId=${configId}`).then((r) => r.json()),
      fetch(`/api/alerts?digestConfigId=${configId}`).then((r) => r.json()),
      fetch(`/api/exclusions?digestConfigId=${configId}`).then((r) => r.json()),
    ]);
    const activeConfig = Array.isArray(configsRes)
      ? configsRes.find((c: DigestConfig) => c.id === configId) || null
      : null;
    setConfig(activeConfig);
    setTopics(Array.isArray(topicsRes) ? topicsRes : []);
    setSources(Array.isArray(sourcesRes) ? sourcesRes : []);
    setAlerts(Array.isArray(alertsRes) ? alertsRes : []);
    setExclusions(Array.isArray(exclusionsRes) ? exclusionsRes : []);
    setLoading(false);
  }, [configId]);

  useEffect(() => {
    if (!configId) { router.push("/"); return; }
    loadData();
  }, [configId, loadData, router]);

  function showSavedToast() {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  }

  function handleSaved() {
    loadData();
    showSavedToast();
  }

  async function handleSettingsChange(updates: Partial<UserSettings>) {
    if (!config) return;
    setConfig((prev) => prev ? { ...prev, ...updates } : prev);
    await fetch("/api/digest-configs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: config.id, ...updates }),
    });
    showSavedToast();
  }

  async function handleAddExclusion(keyword: string) {
    await fetch("/api/exclusions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, digest_config_id: configId }),
    });
    loadData();
    showSavedToast();
  }

  async function handleRemoveExclusion(id: string) {
    await fetch(`/api/exclusions?id=${id}`, { method: "DELETE" });
    loadData();
  }

  async function handleDeleteConfig() {
    await fetch(`/api/digest-configs?id=${configId}`, { method: "DELETE" });
    router.push("/");
  }

  async function handleRunDigest() {
    if (!configId || isGenerating) return;
    await startGeneration(configId);
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const settingsForAdvanced: UserSettings = config
    ? { user_id: config.user_id, digest_time: config.digest_time, language: config.language, summary_style: config.summary_style, max_articles: config.max_articles, created_at: config.created_at, updated_at: config.updated_at }
    : { user_id: "", digest_time: "07:00", language: "pt-BR", summary_style: "executive", max_articles: 20, created_at: "", updated_at: "" };

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
          <div className="flex items-center gap-2">
            {config && <span className="text-2xl">{config.icon}</span>}
            <div>
              <h1 className="text-[22px] font-bold tracking-tight leading-tight">{config?.name || "Configuracoes"}</h1>
              <p className="text-[12px] text-text-muted leading-tight">Editando configuracoes do digest</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Saved toast indicator */}
          <div
            className={`flex items-center gap-1.5 text-[12px] font-medium transition-all duration-300 ${
              savedToast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"
            }`}
            style={{ color: "var(--color-success)" }}
          >
            <Check className="w-3.5 h-3.5" />
            Salvo
          </div>

          <Button
            onClick={handleRunDigest}
            disabled={isGenerating}
            loading={isGenerating}
            size="sm"
            className="rounded-full"
          >
            <Play className="w-3.5 h-3.5 mr-1.5" />
            {isGenerating ? "Gerando..." : "Rodar digest"}
          </Button>
        </div>
      </header>

      {/* Status card */}
      {config && (
        <Card className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${config.is_active ? "bg-success" : "bg-text-muted"}`} />
            <span className="text-[14px] text-text-secondary">
              {config.is_active ? "Ativo" : "Inativo"} · {config.digest_time} · {config.max_articles} artigos max
            </span>
            {config.digest_type === "trends" && (
              <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--color-primary) 15%, transparent)", color: "var(--color-primary)" }}>
                <TrendingUp className="w-2.5 h-2.5" />
                TRENDS
              </span>
            )}
          </div>
          <span className="text-[12px] text-text-muted">
            {config.language === "pt-BR" ? "PT-BR" : config.language.toUpperCase()} · {config.summary_style === "executive" ? "Executivo" : config.summary_style === "complete" ? "Completo" : "Detalhado"}
          </span>
        </Card>
      )}

      <div className="flex flex-col gap-5">
        {config?.digest_type === "trends" ? (
          <>
            <TrendsEditor
              topic={config.trend_topic || ""}
              keywords={config.trend_keywords || []}
              onSave={async (topic, keywords) => {
                await handleSettingsChange({
                  // @ts-expect-error — trends fields on UserSettings are not typed but API accepts them
                  trend_topic: topic,
                  trend_keywords: keywords,
                });
              }}
            />
            <AlertsList alerts={alerts} onRefresh={handleSaved} configId={configId!} />
          </>
        ) : (
          <>
            <TopicsList topics={topics} onRefresh={handleSaved} configId={configId!} />
            <SourcesList sources={sources} topics={topics} onRefresh={handleSaved} configId={configId!} />
            <AlertsList alerts={alerts} onRefresh={handleSaved} configId={configId!} />
          </>
        )}
        <AdvancedOptions
          settings={settingsForAdvanced}
          exclusions={exclusions}
          onSettingsChange={handleSettingsChange}
          onAddExclusion={handleAddExclusion}
          onRemoveExclusion={handleRemoveExclusion}
        />

        <button
          onClick={() => setDeleteModalOpen(true)}
          className="flex items-center gap-2 text-danger text-[14px] font-medium mt-4 hover:underline self-start"
        >
          <Trash2 className="w-4 h-4" />
          Deletar este digest
        </button>
      </div>

      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Deletar Digest">
        <p className="text-text-secondary text-[14px] mb-5 leading-relaxed">
          Tem certeza que deseja deletar &quot;{config?.icon} {config?.name}&quot;? Todas as fontes, temas e alertas associados serao removidos.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
          <Button onClick={handleDeleteConfig} className="bg-danger hover:bg-danger/80 text-white">
            Deletar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
