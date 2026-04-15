"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Building2, Rss, Tag } from "lucide-react";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { MarketsListSkeleton } from "@/components/markets/MarketsListSkeleton";

type MarketSummary = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  market_subtopics: { id: string; label: string }[];
  market_competitors: { id: string; name: string; website: string | null; enabled: boolean }[];
  market_sources: { id: string; name: string; url: string; enabled: boolean }[];
};

export default function MarketsListPage() {
  const router = useRouter();
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/markets");
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setMarkets(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const newButton = (
    <Button
      onClick={() => router.push("/markets/new")}
      className="ml-1 rounded-full h-9 px-4 gap-1.5 text-[13px]"
    >
      <Plus className="w-3.5 h-3.5" /> Novo
    </Button>
  );

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8 pb-20">
      <AppHeader rightSlot={newButton} />

      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Seus markets
        </p>
        <p className="text-[13px] text-text-secondary mt-0.5">
          Acompanhe setores, concorrentes e menções em tempo real.
        </p>
      </div>

      {loading ? (
        <MarketsListSkeleton />
      ) : markets.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-text-secondary text-[17px] font-medium mb-1">Nenhum market ainda</p>
          <p className="text-text-muted text-[14px] mb-6">
            Crie um market para acompanhar um setor e seus concorrentes.
          </p>
          <Button onClick={() => router.push("/markets/new")} className="rounded-full px-6">
            Criar primeiro market
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {markets.map((m) => {
            const competitorsCount = m.market_competitors?.filter((c) => c.enabled).length ?? 0;
            const sourcesCount = m.market_sources?.filter((s) => s.enabled).length ?? 0;
            const subtopicsCount = m.market_subtopics?.length ?? 0;
            return (
              <button
                key={m.id}
                onClick={() => router.push(`/markets/${m.id}`)}
                onMouseEnter={() => router.prefetch(`/markets/${m.id}`)}
                className="group text-left p-4 rounded-[14px] bg-surface border border-border hover:border-primary/50 hover:bg-surface-light transition-all active:scale-[0.99]"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-11 h-11 rounded-[12px] flex items-center justify-center text-2xl shrink-0 transition-transform group-hover:scale-105"
                    style={{ backgroundColor: `${m.color}22` }}
                  >
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold truncate">{m.name}</p>
                    {m.description && (
                      <p className="text-[12px] text-text-muted line-clamp-2 mt-0.5 leading-snug">{m.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full bg-background text-[10px] text-text-secondary">
                    <Building2 className="w-2.5 h-2.5" /> {competitorsCount}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full bg-background text-[10px] text-text-secondary">
                    <Rss className="w-2.5 h-2.5" /> {sourcesCount}
                  </span>
                  {subtopicsCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full bg-background text-[10px] text-text-secondary">
                      <Tag className="w-2.5 h-2.5" /> {subtopicsCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
