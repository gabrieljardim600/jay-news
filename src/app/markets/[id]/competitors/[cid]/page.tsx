"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, ExternalLink, Globe } from "lucide-react";
import Image from "next/image";

type Competitor = {
  id: string;
  name: string;
  website: string | null;
  logo_url: string | null;
  aliases: string[];
  ai_suggested: boolean;
  enabled: boolean;
};

type Article = {
  id: string;
  title: string;
  source_name: string;
  source_url: string;
  summary: string | null;
  image_url: string | null;
  published_at: string | null;
  detected_at: string;
  found_via: "general" | "competitor";
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

export default function CompetitorDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; cid: string }>();
  const marketId = params?.id;
  const competitorId = params?.cid;

  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [marketName, setMarketName] = useState<string>("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!marketId || !competitorId) return;
    setLoading(true);
    const [marketRes, articlesRes] = await Promise.all([
      fetch(`/api/markets/${marketId}`),
      fetch(`/api/markets/${marketId}/articles?competitorId=${competitorId}&limit=100`),
    ]);
    if (marketRes.ok) {
      const m = await marketRes.json();
      setMarketName(m.name);
      const c = m.market_competitors.find((x: Competitor) => x.id === competitorId);
      setCompetitor(c || null);
    }
    if (articlesRes.ok) setArticles(await articlesRes.json());
    setLoading(false);
  }, [marketId, competitorId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="min-h-screen max-w-3xl mx-auto px-5 py-10 text-text-muted text-[14px]">Carregando...</div>;
  if (!competitor) return <div className="min-h-screen max-w-3xl mx-auto px-5 py-10 text-text-muted text-[14px]">Concorrente não encontrado.</div>;

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-10 pb-20">
      <header className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push(`/markets/${marketId}`)}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-secondary"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </button>
        <div className="w-11 h-11 rounded-[12px] bg-surface flex items-center justify-center">
          {competitor.logo_url ? (
            <Image src={competitor.logo_url} alt={competitor.name} width={44} height={44} className="rounded-[12px] object-cover" unoptimized />
          ) : (
            <Building2 className="w-5 h-5 text-text-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight truncate">{competitor.name}</h1>
          <p className="text-text-muted text-[13px] truncate">
            {marketName}
            {competitor.website && (
              <>
                {" · "}
                <a href={competitor.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-text">
                  <Globe className="w-3 h-3" /> Site
                </a>
              </>
            )}
          </p>
        </div>
      </header>

      <div className="mb-6 p-3 rounded-[10px] bg-primary/5 border border-primary/20">
        <p className="text-[12px] text-text-secondary">
          <span className="font-medium text-text">Briefing completo</span> chega na próxima fase — visão
          geral, pontos fortes/fracos, identidade visual e ameaças competitivas.
        </p>
      </div>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-3">
          Histórico de tracking ({articles.length})
        </h2>
        {articles.length === 0 ? (
          <div className="text-center py-10 rounded-[12px] bg-surface border border-border">
            <p className="text-[14px] text-text-secondary mb-1">Nenhuma notícia deste concorrente.</p>
            <p className="text-[12px] text-text-muted">Rode uma coleta no market para buscar.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {articles.map((a) => (
              <a
                key={a.id}
                href={a.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 p-3 rounded-[12px] bg-surface border border-border hover:border-primary/40 transition-all"
              >
                {a.image_url && (
                  <div className="relative w-16 h-16 rounded-[8px] overflow-hidden bg-background shrink-0">
                    <Image src={a.image_url} alt="" fill sizes="64px" className="object-cover" unoptimized />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold leading-snug line-clamp-2">{a.title}</p>
                  {a.summary && <p className="text-[11px] text-text-secondary mt-1 line-clamp-2">{a.summary}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-text-muted">{a.source_name}</span>
                    {a.published_at && <span className="text-[10px] text-text-muted">· {timeAgo(a.published_at)}</span>}
                    <ExternalLink className="w-2.5 h-2.5 text-text-muted" />
                    {a.found_via === "competitor" && (
                      <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        Direto
                      </span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
