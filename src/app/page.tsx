"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Settings, RefreshCw } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { FeedSkeleton } from "@/components/digest/FeedSkeleton";
import { DigestTabs } from "@/components/feed/DigestTabs";
import { DaySummary } from "@/components/digest/DaySummary";
import { HighlightCards } from "@/components/digest/HighlightCards";
import { CategorySection } from "@/components/digest/CategorySection";
import { AlertsSection } from "@/components/digest/AlertsSection";
import { DigestDateSelector } from "@/components/digest/DigestDateSelector";
import { TrendingSection } from "@/components/feed/TrendingSection";
import { useGeneration } from "@/context/GenerationContext";
import type { Digest, DigestConfig, DigestWithArticles, Topic } from "@/types";

export default function FeedPage() {
  const [configs, setConfigs] = useState<DigestConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [digests, setDigests] = useState<Digest[]>([]);
  const [current, setCurrent] = useState<DigestWithArticles | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const { genState, startGeneration } = useGeneration();
  const prevGenStatus = useRef(genState.status);

  useEffect(() => {
    async function loadConfigs() {
      const res = await fetch("/api/digest-configs");
      if (!res.ok) { setLoading(false); return; }
      const data: DigestConfig[] = await res.json();
      if (!Array.isArray(data) || data.length === 0) { router.push("/wizard"); return; }
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

  // Refresh digest list when generation completes
  useEffect(() => {
    if (
      prevGenStatus.current === "generating" &&
      genState.status === "completed" &&
      genState.configId
    ) {
      loadDigestsForConfig(genState.configId);
    }
    prevGenStatus.current = genState.status;
  }, [genState.status, genState.configId, loadDigestsForConfig]);

  function handleSelectConfig(id: string) {
    setActiveConfigId(id);
    setCurrent(null);
    setDigests([]);
  }

  async function handleGenerate() {
    if (!activeConfigId || genState.status === "generating") return;
    await startGeneration(activeConfigId);
  }

  const getTopicName = (topicId: string) =>
    topics.find((t) => t.id === topicId)?.name || "Outros";

  if (loading) return <FeedSkeleton />;

  const isGenerating = genState.status === "generating";

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-10 pb-28">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-bold font-heading tracking-tight">JNews</h1>
          <p className="text-[13px] text-text-muted mt-0.5">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
        </div>
        <div className="flex gap-1 items-center">
          <ThemeToggle />
          <button
            onClick={() => router.push("/manage")}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-muted hover:text-text"
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`ml-1 h-9 px-4 flex items-center gap-2 rounded-full text-[13px] font-medium transition-all duration-200 active:scale-[0.97] ${
              isGenerating
                ? "bg-surface text-text-muted"
                : "bg-primary text-white hover:bg-primary-hover shadow-sm"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin opacity-50" : ""}`} />
            {isGenerating ? "Gerando..." : "Gerar digest"}
          </button>
        </div>
      </header>

      {/* Digest tabs */}
      <DigestTabs configs={configs} activeId={activeConfigId} onSelect={handleSelectConfig} />

      {/* Date selector */}
      <DigestDateSelector
        digests={digests}
        selectedId={current?.id || null}
        onSelect={loadDigest}
      />

      {/* Empty state */}
      {!current && digests.length === 0 && !isGenerating && (
        <div className="text-center py-24">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
            <span className="text-2xl">📭</span>
          </div>
          <p className="text-text-secondary text-[17px] font-medium mb-1">Nenhum digest ainda</p>
          <p className="text-text-muted text-[14px]">Clique em &quot;Gerar digest&quot; para criar o primeiro.</p>
        </div>
      )}

      {/* Digest content */}
      {current && (
        <div className="flex flex-col gap-8 mt-4">
          <DaySummary summary={current.summary} />

          {current.metadata?.trends && current.metadata.trends.length > 0 && (
            <TrendingSection trends={current.metadata.trends} />
          )}

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
