"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Settings } from "lucide-react";
import { AppHeader } from "@/components/ui/AppHeader";
import { FeedFilters } from "@/components/gossip/FeedFilters";
import { FeedList } from "@/components/gossip/FeedList";
import { DossierGrid } from "@/components/gossip/DossierGrid";
import { SettingsDrawer } from "@/components/gossip/SettingsDrawer";
import type { GossipSource, GossipTopic } from "@/lib/gossip/types";

export default function GossipPage() {
  const router = useRouter();
  const [sources, setSources] = useState<GossipSource[]>([]);
  const [topics, setTopics] = useState<GossipTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCollect, setLoadingCollect] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [selectedTopicId, setSelectedTopicId] = useState<string | undefined>();
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>();

  const loadSources = useCallback(async () => {
    const res = await fetch("/api/gossip/sources");
    if (res.ok) {
      const data = await res.json();
      setSources(Array.isArray(data) ? data : []);
    }
  }, []);

  const loadTopics = useCallback(async () => {
    const res = await fetch("/api/gossip/topics");
    if (res.ok) {
      const data = await res.json();
      setTopics(Array.isArray(data) ? data : []);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([loadSources(), loadTopics()]);
      setLoading(false);
    })();
  }, [loadSources, loadTopics]);

  useEffect(() => {
    if (!loading && sources.length === 0) {
      router.push("/gossip/new");
    }
  }, [loading, sources.length, router]);

  async function handleTagTopic(
    action: "confirm" | "reject",
    topicId: string,
    postId: string
  ) {
    try {
      const res = await fetch(`/api/gossip/posts/${postId}/tag-topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic_id: topicId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Erro: ${data?.error || `HTTP ${res.status}`}`);
        return;
      }
      setFeedRefreshKey((k) => k + 1);
    } catch (err) {
      alert(`Erro de rede: ${(err as Error).message}`);
    }
  }

  async function collect() {
    if (loadingCollect) return;
    setLoadingCollect(true);
    try {
      const res = await fetch("/api/gossip/collect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Erro ao coletar: ${data?.error || `HTTP ${res.status}`}`);
        return;
      }
      const inserted = Number(data?.inserted ?? 0);
      const errors = Array.isArray(data?.errors) ? data.errors.length : 0;
      alert(`${inserted} post(s) novo(s) / ${errors} erro(s)`);
      setFeedRefreshKey((k) => k + 1);
      await loadSources();
    } catch (err) {
      alert(`Erro de rede: ${(err as Error).message}`);
    } finally {
      setLoadingCollect(false);
    }
  }

  const refreshBtn = (
    <button
      disabled={loadingCollect}
      onClick={collect}
      className={`ml-1 h-9 px-4 flex items-center gap-2 rounded-full text-[13px] font-medium transition-all duration-200 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed ${
        loadingCollect ? "bg-surface text-text-muted" : "bg-primary text-white hover:bg-primary-hover shadow-sm"
      }`}
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loadingCollect ? "animate-spin opacity-60" : ""}`} />
      {loadingCollect ? "Buscando..." : "Atualizar"}
    </button>
  );

  const settingsBtn = (
    <button
      onClick={() => setSettingsOpen(true)}
      aria-label="Configurações do Gossip"
      title="Configurações do Gossip"
      className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-muted hover:text-text"
    >
      <Settings className="w-[18px] h-[18px]" />
    </button>
  );

  const rightSlot = (
    <>
      {settingsBtn}
      {refreshBtn}
    </>
  );

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8 pb-20">
      <AppHeader rightSlot={rightSlot} />

      {loading || sources.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <FeedFilters
            topics={topics}
            sources={sources}
            selectedTopicId={selectedTopicId}
            selectedSourceId={selectedSourceId}
            onTopicChange={setSelectedTopicId}
            onSourceChange={setSelectedSourceId}
          />

          <section>
            <h2 className="text-[15px] font-semibold mb-3">Dossiês de hoje</h2>
            <DossierGrid refreshKey={feedRefreshKey} />
          </section>

          <section>
            <h2 className="text-[15px] font-semibold mb-3">Feed</h2>
            <FeedList
              topicId={selectedTopicId}
              sourceId={selectedSourceId}
              refreshKey={feedRefreshKey}
              topics={topics}
              onTag={handleTagTopic}
            />
          </section>
        </div>
      )}

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        sources={sources}
        topics={topics}
        onSourcesChange={loadSources}
        onTopicsChange={loadTopics}
      />
    </div>
  );
}
