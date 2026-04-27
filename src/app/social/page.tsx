"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Settings, Users, Megaphone, AlertCircle, CheckCircle, Circle } from "lucide-react";
import { AppHeader } from "@/components/ui/AppHeader";
import { PostCard } from "@/components/social/PostCard";
import { SourcesManager } from "@/components/social/SourcesManager";
import type { CrowdSource, SocialPost, SocialVoice } from "@/types";

type Tab = "voices" | "crowd";

interface SourceReport {
  kind: "voice" | "crowd";
  label: string;
  platform: string;
  fetched: number;
  upserted: number;
  status: "ok" | "empty" | "error";
  error?: string;
}

export default function SocialPage() {
  const [tab, setTab] = useState<Tab>("voices");
  const [voices, setVoices] = useState<SocialVoice[]>([]);
  const [crowd, setCrowd] = useState<CrowdSource[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [collectMessage, setCollectMessage] = useState<string | null>(null);
  const [collectReports, setCollectReports] = useState<SourceReport[]>([]);

  const loadAll = useCallback(async () => {
    const [voicesRes, crowdRes, feedRes] = await Promise.all([
      fetch("/api/social/voices").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/social/crowd").then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/social/feed?type=${tab}`).then((r) => (r.ok ? r.json() : [])),
    ]);
    setVoices(Array.isArray(voicesRes) ? voicesRes : []);
    setCrowd(Array.isArray(crowdRes) ? crowdRes : []);
    setPosts(Array.isArray(feedRes) ? feedRes : []);
    setLoading(false);
  }, [tab]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function refreshFeed() {
    const res = await fetch(`/api/social/feed?type=${tab}`);
    if (res.ok) {
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    }
  }

  async function collect() {
    if (collecting) return;
    setCollecting(true);
    setCollectMessage(null);
    setCollectReports([]);
    try {
      const res = await fetch("/api/social/collect", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const summary = `+${data.postsUpserted ?? 0} posts coletados`;
        setCollectMessage(summary);
        setCollectReports(Array.isArray(data.reports) ? data.reports : []);
        await refreshFeed();
      } else {
        setCollectMessage(`Erro: ${data.error || `HTTP ${res.status}`}`);
      }
    } catch (err) {
      setCollectMessage(`Erro de rede: ${(err as Error).message}`);
    } finally {
      setCollecting(false);
    }
  }

  const sourcesCount = tab === "voices" ? voices.length : crowd.length;
  const TabIcon = tab === "voices" ? Users : Megaphone;
  const emptyTitle = tab === "voices" ? "Sem vozes ainda" : "Sem fontes do Pulso ainda";
  const emptyHint = sourcesCount === 0
    ? "Adicione perfis em \"Gerenciar fontes\" e clique em \"Atualizar\"."
    : "Clique em \"Atualizar\" para puxar os posts mais recentes.";

  const refreshBtn = (
    <button
      onClick={collect}
      disabled={collecting}
      className={`ml-1 h-9 px-4 flex items-center gap-2 rounded-full text-[13px] font-medium transition-all duration-200 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed ${
        collecting ? "bg-surface text-text-muted" : "bg-primary text-white hover:bg-primary-hover shadow-sm"
      }`}
    >
      <RefreshCw className={`w-3.5 h-3.5 ${collecting ? "animate-spin opacity-60" : ""}`} />
      {collecting ? "Atualizando..." : "Atualizar"}
    </button>
  );

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8 pb-28">
      <AppHeader rightSlot={refreshBtn} />

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-border">
          <TabButton active={tab === "voices"} onClick={() => setTab("voices")} label="Vozes" icon={Users} />
          <TabButton active={tab === "crowd"} onClick={() => setTab("crowd")} label="Pulso" icon={Megaphone} />
        </div>

        <a
          href="/social/brands"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-surface hover:bg-surface-light text-text-secondary hover:text-text transition-colors text-[12px] font-medium"
        >
          <Megaphone className="w-3.5 h-3.5" />
          Marcas
        </a>

        <button
          onClick={() => setManagerOpen(true)}
          className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-surface hover:bg-surface-light text-text-secondary hover:text-text transition-colors text-[12px] font-medium"
        >
          <Settings className="w-3.5 h-3.5" />
          Gerenciar fontes
        </button>
      </div>

      {collectMessage && (
        <div className="mb-3 px-3 py-2 rounded-[10px] bg-surface text-[12px] text-text-secondary flex items-center justify-between gap-2">
          <span>{collectMessage}</span>
          <button
            onClick={() => { setCollectMessage(null); setCollectReports([]); }}
            className="text-text-muted hover:text-text text-[10px] uppercase tracking-wide"
          >
            Fechar
          </button>
        </div>
      )}

      {collectReports.length > 0 && (
        <details className="mb-4 px-3 py-2 rounded-[10px] bg-surface text-[12px]">
          <summary className="cursor-pointer text-text-muted">Detalhes por fonte ({collectReports.length})</summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {collectReports.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                {r.status === "ok" && <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />}
                {r.status === "empty" && <Circle className="w-3.5 h-3.5 text-text-muted shrink-0" />}
                {r.status === "error" && <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0" />}
                <span className="text-[11px] uppercase tracking-wider text-text-muted shrink-0">{r.platform}</span>
                <span className="text-[12px] text-text truncate">{r.label}</span>
                <span className="ml-auto text-[11px] text-text-muted shrink-0">
                  {r.status === "ok" && `+${r.upserted}`}
                  {r.status === "empty" && "0 posts"}
                  {r.status === "error" && (r.error || "erro").slice(0, 80)}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
            <TabIcon className="w-6 h-6 text-text-muted" />
          </div>
          <p className="text-text-secondary text-[17px] font-medium mb-1">{emptyTitle}</p>
          <p className="text-text-muted text-[14px]">{emptyHint}</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}

      <SourcesManager
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        voices={voices}
        crowd={crowd}
        onRefresh={loadAll}
      />
    </div>
  );
}

function TabButton({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: typeof Users }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium transition-all duration-200 ${
        active ? "bg-text text-background shadow-sm" : "text-text-muted hover:text-text"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
}
