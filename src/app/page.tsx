"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { FeedSkeleton } from "@/components/digest/FeedSkeleton";
import { DigestTabs } from "@/components/feed/DigestTabs";
import { DaySummary } from "@/components/digest/DaySummary";
import { HighlightCards } from "@/components/digest/HighlightCards";
import { CategorySection } from "@/components/digest/CategorySection";
import { AlertsSection } from "@/components/digest/AlertsSection";
import { DigestDateSelector } from "@/components/digest/DigestDateSelector";
import type { Digest, DigestConfig, DigestWithArticles, Topic } from "@/types";

export default function FeedPage() {
  const [configs, setConfigs] = useState<DigestConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [digests, setDigests] = useState<Digest[]>([]);
  const [current, setCurrent] = useState<DigestWithArticles | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const router = useRouter();

  // Load configs on mount
  useEffect(() => {
    async function loadConfigs() {
      const res = await fetch("/api/digest-configs");
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data: DigestConfig[] = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        router.push("/wizard");
        return;
      }
      setConfigs(data);
      setActiveConfigId(data[0].id);
      setLoading(false);
    }
    loadConfigs();
  }, [router]);

  const loadDigest = useCallback(async (id: string) => {
    const res = await fetch(`/api/digest/${id}`);
    const data = await res.json();
    setCurrent(data);
  }, []);

  const loadDigestsForConfig = useCallback(async (configId: string) => {
    const [digestsRes, topicsRes] = await Promise.all([
      fetch(`/api/digests?limit=10&digestConfigId=${configId}`).then((r) => r.json()),
      fetch(`/api/topics?digestConfigId=${configId}`).then((r) => r.json()),
    ]);
    setDigests(Array.isArray(digestsRes) ? digestsRes : []);
    setTopics(Array.isArray(topicsRes) ? topicsRes : []);
    if (Array.isArray(digestsRes) && digestsRes.length > 0) {
      await loadDigest(digestsRes[0].id);
    } else {
      setCurrent(null);
    }
  }, [loadDigest]);

  useEffect(() => {
    if (activeConfigId) loadDigestsForConfig(activeConfigId);
  }, [activeConfigId, loadDigestsForConfig]);

  function handleSelectConfig(id: string) {
    setActiveConfigId(id);
    setCurrent(null);
    setDigests([]);
  }

  async function handleGenerate() {
    if (!activeConfigId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/digest/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestConfigId: activeConfigId }),
      });
      const { digestId } = await res.json();
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((r) => setTimeout(r, 2000));
        const check = await fetch(`/api/digest/${digestId}`);
        const data = await check.json();
        if (data.status === "completed" || data.status === "failed") {
          await loadDigestsForConfig(activeConfigId);
          break;
        }
        attempts++;
      }
    } finally {
      setGenerating(false);
    }
  }

  const getTopicName = (topicId: string) =>
    topics.find((t) => t.id === topicId)?.name || "Outros";

  const activeConfig = configs.find((c) => c.id === activeConfigId);

  if (loading) {
    return <FeedSkeleton />;
  }

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold font-heading">JNews</h1>
          <p className="text-sm text-text-secondary">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <ThemeToggle />
          <Button variant="ghost" onClick={() => setShowSettings(true)} title="Configurações">⚙</Button>
          <Button onClick={handleGenerate} loading={generating}>
            {generating ? "Gerando..." : "Gerar Digest"}
          </Button>
        </div>
      </header>

      <DigestTabs configs={configs} activeId={activeConfigId} onSelect={handleSelectConfig} />

      <DigestDateSelector
        digests={digests}
        selectedId={current?.id || null}
        onSelect={loadDigest}
      />

      {!current && digests.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-text-secondary text-lg mb-2">Nenhum digest ainda</p>
          <p className="text-text-muted text-sm mb-6">Clique em &quot;Gerar Digest&quot; para criar o primeiro.</p>
        </div>
      )}

      {current && (
        <div className="flex flex-col gap-6 mt-6">
          <DaySummary summary={current.summary} />
          <HighlightCards articles={current.highlights} />
          {Object.entries(current.by_topic)
            .filter(([key]) => key !== "uncategorized")
            .map(([topicId, articles]) => (
              <CategorySection key={topicId} name={getTopicName(topicId)} articles={articles} />
            ))}
          {current.by_topic["uncategorized"] && (
            <CategorySection name="Outros" articles={current.by_topic["uncategorized"]} />
          )}
          <AlertsSection articles={current.alert_articles} />
        </div>
      )}
    </div>
  );
}
