"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TopicsList } from "@/components/settings/TopicsList";
import { SourcesList } from "@/components/settings/SourcesList";
import { AlertsList } from "@/components/settings/AlertsList";
import { AdvancedOptions } from "@/components/settings/AdvancedOptions";
import type { Topic, RssSource, Alert, Exclusion, DigestConfig, UserSettings } from "@/types";

function SettingsContent() {
  const [config, setConfig] = useState<DigestConfig | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sources, setSources] = useState<RssSource[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const configId = searchParams.get("configId");

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
    if (!configId) {
      router.push("/");
      return;
    }
    loadData();
  }, [configId, loadData, router]);

  async function handleSettingsChange(updates: Partial<UserSettings>) {
    if (!config) return;
    setConfig((prev) => prev ? { ...prev, ...updates } : prev);
    await fetch("/api/digest-configs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: config.id, ...updates }),
    });
  }

  async function handleAddExclusion(keyword: string) {
    await fetch("/api/exclusions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, digest_config_id: configId }),
    });
    loadData();
  }

  async function handleRemoveExclusion(id: string) {
    await fetch(`/api/exclusions?id=${id}`, { method: "DELETE" });
    loadData();
  }

  async function handleDeleteConfig() {
    await fetch(`/api/digest-configs?id=${configId}`, { method: "DELETE" });
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Map DigestConfig to UserSettings shape for AdvancedOptions (reuse existing component)
  const settingsForAdvanced: UserSettings = config
    ? {
        user_id: config.user_id,
        digest_time: config.digest_time,
        language: config.language,
        summary_style: config.summary_style,
        max_articles: config.max_articles,
        created_at: config.created_at,
        updated_at: config.updated_at,
      }
    : {
        user_id: "",
        digest_time: "07:00",
        language: "pt-BR",
        summary_style: "executive",
        max_articles: 20,
        created_at: "",
        updated_at: "",
      };

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          {config && <span className="text-2xl">{config.icon}</span>}
          <h1 className="text-2xl font-bold">{config?.name || "Configuracoes"}</h1>
        </div>
        <Button variant="outline" onClick={() => router.push("/")}>
          Voltar
        </Button>
      </header>

      <div className="flex flex-col gap-6">
        <TopicsList topics={topics} onRefresh={loadData} configId={configId!} />
        <SourcesList sources={sources} topics={topics} onRefresh={loadData} configId={configId!} />
        <AlertsList alerts={alerts} onRefresh={loadData} configId={configId!} />
        <AdvancedOptions
          settings={settingsForAdvanced}
          exclusions={exclusions}
          onSettingsChange={handleSettingsChange}
          onAddExclusion={handleAddExclusion}
          onRemoveExclusion={handleRemoveExclusion}
        />

        <div className="border-t border-border pt-6">
          <Button
            variant="ghost"
            className="text-danger hover:text-danger"
            onClick={() => setDeleteModalOpen(true)}
          >
            Deletar este digest
          </Button>
        </div>
      </div>

      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Deletar Digest">
        <p className="text-text-secondary mb-4">
          Tem certeza que deseja deletar &quot;{config?.icon} {config?.name}&quot;? Isso ira remover todas as fontes, temas e alertas associados.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleDeleteConfig}
            className="bg-danger hover:bg-danger/80 text-white"
          >
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
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
