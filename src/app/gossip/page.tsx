"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Settings } from "lucide-react";
import { AppHeader } from "@/components/ui/AppHeader";
import { FeedFilters } from "@/components/gossip/FeedFilters";
import { FeedList } from "@/components/gossip/FeedList";
import type { GossipSource, GossipTopic } from "@/lib/gossip/types";

export default function GossipPage() {
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

  const refreshBtn = (
    <button
      disabled={loadingCollect}
      onClick={() => {
        // Will be wired in Task 12
      }}
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

  // Silence unused warnings until wired in later tasks
  void setLoadingCollect;
  void settingsOpen;
  void setFeedRefreshKey;

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8 pb-20">
      <AppHeader rightSlot={rightSlot} />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
            <Settings className="w-6 h-6 text-text-muted" />
          </div>
          <p className="text-text-secondary text-[17px] font-medium mb-1">Nenhuma fonte</p>
          <p className="text-text-muted text-[14px]">Use Settings para adicionar fontes de gossip.</p>
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
            <p className="text-text-muted text-[13px]">Nenhum dossiê ainda.</p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold mb-3">Feed</h2>
            <FeedList
              topicId={selectedTopicId}
              sourceId={selectedSourceId}
              refreshKey={feedRefreshKey}
              topics={topics}
            />
          </section>
        </div>
      )}
    </div>
  );
}
