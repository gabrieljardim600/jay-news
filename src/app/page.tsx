"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DaySummary } from "@/components/digest/DaySummary";
import { HighlightCards } from "@/components/digest/HighlightCards";
import { CategorySection } from "@/components/digest/CategorySection";
import { AlertsSection } from "@/components/digest/AlertsSection";
import { DigestDateSelector } from "@/components/digest/DigestDateSelector";
import type { Digest, DigestWithArticles, Topic } from "@/types";

export default function FeedPage() {
  const [digests, setDigests] = useState<Digest[]>([]);
  const [current, setCurrent] = useState<DigestWithArticles | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadDigest = useCallback(async (id: string) => {
    const res = await fetch(`/api/digest/${id}`);
    const data = await res.json();
    setCurrent(data);
  }, []);

  const loadDigests = useCallback(async () => {
    const [digestsRes, topicsRes] = await Promise.all([
      fetch("/api/digests?limit=10").then((r) => r.json()),
      fetch("/api/topics").then((r) => r.json()),
    ]);
    setDigests(digestsRes);
    setTopics(topicsRes);
    if (digestsRes.length > 0) {
      await loadDigest(digestsRes[0].id);
    }
    setLoading(false);
  }, [loadDigest]);

  useEffect(() => {
    loadDigests();
  }, [loadDigests]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/digest/generate", { method: "POST" });
      const { digestId } = await res.json();
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((r) => setTimeout(r, 2000));
        const check = await fetch(`/api/digest/${digestId}`);
        const data = await check.json();
        if (data.status === "completed" || data.status === "failed") {
          await loadDigests();
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">JNews</h1>
          {current && (
            <p className="text-text-secondary text-sm">
              Digest de {new Date(current.generated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerate} loading={generating}>
            {generating ? "Gerando..." : "Gerar Digest"}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/settings")}>
            ⚙
          </Button>
        </div>
      </header>

      <DigestDateSelector digests={digests} selectedId={current?.id || null} onSelect={loadDigest} />

      {!current && digests.length === 0 && (
        <div className="text-center py-20">
          <p className="text-text-secondary text-lg mb-4">Nenhum digest gerado ainda.</p>
          <p className="text-text-muted text-sm mb-6">Configure seus temas em Configuracoes e gere seu primeiro digest.</p>
          <Button onClick={() => router.push("/settings")}>Ir para Configuracoes</Button>
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
