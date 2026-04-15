"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Building2, Rss } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
    (async () => {
      const res = await fetch("/api/markets");
      if (res.ok) {
        const data = await res.json();
        setMarkets(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-10">
      <header className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-secondary"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
          </button>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">Markets</h1>
            <p className="text-text-muted text-[13px]">Acompanhamento de mercados e concorrentes</p>
          </div>
        </div>
        <Button onClick={() => router.push("/markets/new")} className="rounded-full px-5 gap-1.5">
          <Plus className="w-4 h-4" /> Novo
        </Button>
      </header>

      {loading ? (
        <div className="text-center py-20 text-text-muted text-[14px]">Carregando...</div>
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
                className="text-left p-4 rounded-[14px] bg-surface border border-border hover:border-primary/40 hover:bg-surface-light transition-all"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-11 h-11 rounded-[12px] flex items-center justify-center text-2xl shrink-0"
                    style={{ backgroundColor: `${m.color}22` }}
                  >
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold truncate">{m.name}</p>
                    {m.description && (
                      <p className="text-[12px] text-text-muted line-clamp-2 mt-0.5">{m.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-text-muted">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> {competitorsCount} concorrentes
                  </span>
                  <span className="flex items-center gap-1">
                    <Rss className="w-3 h-3" /> {sourcesCount} fontes
                  </span>
                  {subtopicsCount > 0 && <span>· {subtopicsCount} sub-tópicos</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
