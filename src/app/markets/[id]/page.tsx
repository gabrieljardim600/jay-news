"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Rss, Tag, RefreshCw, Loader2, Settings as SettingsIcon } from "lucide-react";
import { MarketDetailSkeleton } from "@/components/markets/MarketsListSkeleton";
import { ArticleRow } from "@/components/markets/ArticleRow";

type Competitor = {
  id: string;
  name: string;
  website: string | null;
  enabled: boolean;
  ai_suggested: boolean;
};

type Source = { id: string; name: string; url: string; source_type: string; enabled: boolean };

type MarketDetail = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  market_subtopics: { id: string; label: string }[];
  market_competitors: Competitor[];
  market_sources: Source[];
};

type MarketArticle = {
  id: string;
  title: string;
  source_name: string;
  source_url: string;
  summary: string | null;
  full_content: string | null;
  image_url: string | null;
  published_at: string | null;
  relevance_score: number;
  mentioned_competitor_ids: string[];
  found_via: "general" | "competitor";
  detected_at: string;
};

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function MarketDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const marketId = params?.id;

  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [articles, setArticles] = useState<MarketArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);

  const loadMarket = useCallback(async () => {
    if (!marketId) return;
    const res = await fetch(`/api/markets/${marketId}`);
    if (res.ok) setMarket(await res.json());
  }, [marketId]);

  const loadArticles = useCallback(async () => {
    if (!marketId) return;
    const res = await fetch(`/api/markets/${marketId}/articles?limit=60`);
    if (res.ok) setArticles(await res.json());
  }, [marketId]);

  useEffect(() => {
    if (!marketId) return;
    (async () => {
      setLoading(true);
      await Promise.all([loadMarket(), loadArticles()]);
      setLoading(false);
    })();
  }, [marketId, loadMarket, loadArticles]);

  async function handleCollect() {
    if (!marketId || collecting) return;
    setCollecting(true);
    setCollectError(null);
    try {
      const res = await fetch(`/api/markets/${marketId}/collect`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erro na coleta (${res.status})`);
      }
      await loadArticles();
    } catch (e) {
      setCollectError(e instanceof Error ? e.message : String(e));
    } finally {
      setCollecting(false);
    }
  }

  const competitorById = useMemo(() => {
    const map = new Map<string, Competitor>();
    market?.market_competitors.forEach((c) => map.set(c.id, c));
    return map;
  }, [market]);

  const articleCountByCompetitor = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of articles) {
      for (const id of a.mentioned_competitor_ids) {
        map.set(id, (map.get(id) ?? 0) + 1);
      }
    }
    return map;
  }, [articles]);

  if (loading) return <MarketDetailSkeleton />;
  if (!market) return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-10 text-center">
      <p className="text-text-secondary text-[15px] mb-4">Market não encontrado.</p>
      <button
        onClick={() => router.push("/markets")}
        className="h-9 px-5 rounded-full bg-surface hover:bg-surface-light text-[13px] text-text-secondary transition-colors"
      >
        ← Voltar para Markets
      </button>
    </div>
  );

  const enabledCompetitors = market.market_competitors.filter((c) => c.enabled);

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-10 pb-20">
      <header className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push("/markets")}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-secondary"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </button>
        <div
          className="w-11 h-11 rounded-[12px] flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${market.color}22` }}
        >
          {market.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight truncate">{market.name}</h1>
          {market.description && <p className="text-text-muted text-[13px] truncate">{market.description}</p>}
        </div>
        <button
          onClick={() => router.push(`/markets/${market.id}/settings`)}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-muted hover:text-text"
          title="Configurações"
        >
          <SettingsIcon className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={handleCollect}
          disabled={collecting}
          className={`h-9 px-4 flex items-center gap-2 rounded-full text-[13px] font-medium transition-all active:scale-[0.97] ${
            collecting ? "bg-surface text-text-muted" : "bg-primary text-white hover:bg-primary-hover shadow-sm"
          }`}
        >
          {collecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {collecting ? "Coletando..." : "Coletar"}
        </button>
      </header>

      {collectError && (
        <div className="mb-6 p-3 rounded-[10px] bg-danger/10 border border-danger/20">
          <p className="text-[13px] text-danger font-medium">{collectError}</p>
        </div>
      )}

      {market.market_subtopics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {market.market_subtopics.map((s) => (
            <span key={s.id} className="px-2.5 py-1 rounded-full text-[12px] bg-surface border border-border text-text-secondary">
              <Tag className="w-2.5 h-2.5 inline mr-1" />
              {s.label}
            </span>
          ))}
        </div>
      )}

      {/* Competitors */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted flex items-center gap-1.5">
            <Building2 className="w-3 h-3" /> Concorrentes ({enabledCompetitors.length})
          </h2>
        </div>
        {enabledCompetitors.length === 0 ? (
          <p className="text-[13px] text-text-muted">Nenhum concorrente cadastrado.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {enabledCompetitors.map((c) => {
              const count = articleCountByCompetitor.get(c.id) ?? 0;
              return (
                <button
                  key={c.id}
                  onClick={() => router.push(`/markets/${market.id}/competitors/${c.id}`)}
                  className="text-left p-3 rounded-[12px] bg-surface border border-border hover:border-primary/40 hover:bg-surface-light transition-all"
                >
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate">{c.name}</p>
                      {count > 0 && (
                        <p className="text-[11px] text-primary mt-0.5 font-medium">{count} menções recentes</p>
                      )}
                      {count === 0 && (
                        <p className="text-[11px] text-text-muted mt-0.5">Sem menções ainda</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* News feed */}
      <section className="mb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-3 flex items-center gap-1.5">
          <Rss className="w-3 h-3" /> Notícias do mercado ({articles.length})
        </h2>
        {articles.length === 0 ? (
          <div className="text-center py-10 rounded-[12px] bg-surface border border-border">
            <p className="text-[14px] text-text-secondary mb-2">Nenhuma notícia coletada ainda.</p>
            <p className="text-[12px] text-text-muted">Clique em &quot;Coletar&quot; para rodar a primeira busca.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {articles.map((a) => {
              const mentioned = a.mentioned_competitor_ids
                .map((id) => competitorById.get(id))
                .filter((c): c is Competitor => !!c);
              return (
                <ArticleRow
                  key={a.id}
                  article={a}
                  timeAgo={timeAgo}
                  badges={mentioned.map((c) => c.name)}
                />
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
