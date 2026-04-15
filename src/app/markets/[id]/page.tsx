"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Rss, Tag } from "lucide-react";

type MarketDetail = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  market_subtopics: { id: string; label: string }[];
  market_competitors: { id: string; name: string; website: string | null; enabled: boolean; ai_suggested: boolean }[];
  market_sources: { id: string; name: string; url: string; source_type: string; enabled: boolean }[];
};

export default function MarketDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    (async () => {
      const res = await fetch(`/api/markets/${params.id}`);
      if (res.ok) setMarket(await res.json());
      setLoading(false);
    })();
  }, [params?.id]);

  if (loading) return <div className="min-h-screen max-w-3xl mx-auto px-5 py-10 text-text-muted text-[14px]">Carregando...</div>;
  if (!market) return <div className="min-h-screen max-w-3xl mx-auto px-5 py-10 text-text-muted text-[14px]">Market não encontrado.</div>;

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-10">
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
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">{market.name}</h1>
          {market.description && <p className="text-text-muted text-[13px]">{market.description}</p>}
        </div>
      </header>

      <div className="p-4 rounded-[12px] bg-primary/5 border border-primary/20 mb-8">
        <p className="text-[13px] text-text-secondary">
          <span className="font-medium text-text">Coleta automática em breve.</span> Este market está configurado.
          Na próxima fase, notícias e atualizações dos concorrentes aparecem aqui diariamente.
        </p>
      </div>

      {market.market_subtopics.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-3 flex items-center gap-1.5">
            <Tag className="w-3 h-3" /> Sub-tópicos
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {market.market_subtopics.map((s) => (
              <span key={s.id} className="px-2.5 py-1 rounded-full text-[12px] bg-surface border border-border">
                {s.label}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-3 flex items-center gap-1.5">
          <Building2 className="w-3 h-3" /> Concorrentes ({market.market_competitors.length})
        </h2>
        {market.market_competitors.length === 0 ? (
          <p className="text-[13px] text-text-muted">Nenhum concorrente cadastrado.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {market.market_competitors.map((c) => (
              <div key={c.id} className="flex items-center gap-2 p-2.5 rounded-[10px] bg-surface border border-border">
                <Building2 className="w-4 h-4 text-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{c.name}</p>
                  {c.website && <p className="text-[11px] text-text-muted truncate">{c.website}</p>}
                </div>
                {c.ai_suggested && (
                  <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">IA</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-3 flex items-center gap-1.5">
          <Rss className="w-3 h-3" /> Fontes ({market.market_sources.length})
        </h2>
        {market.market_sources.length === 0 ? (
          <p className="text-[13px] text-text-muted">Sem fontes específicas — a IA escolhe durante a coleta.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {market.market_sources.map((s) => (
              <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-[10px] bg-surface border border-border">
                <Rss className="w-4 h-4 text-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{s.name}</p>
                  <p className="text-[11px] text-text-muted truncate">{s.url}</p>
                </div>
                <span className="text-[10px] text-text-muted uppercase">{s.source_type}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
