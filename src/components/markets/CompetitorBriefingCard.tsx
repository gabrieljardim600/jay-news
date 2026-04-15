"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, RefreshCw, CheckCircle2, AlertCircle, Zap, Shield, Target, Lightbulb, MessageSquare, Palette, Building2 } from "lucide-react";

type BriefingContent = {
  resumo_executivo: string;
  visao_geral: { fundada?: string | null; sede?: string | null; porte?: string | null; modelo_negocio?: string | null };
  produtos?: string[];
  lideranca?: string[];
  pontos_fortes?: string[];
  pontos_fracos?: string[];
  oportunidades?: string[];
  ameacas?: string[];
  posicionamento?: string;
  movimentos_recentes?: string[];
  identidade_visual?: { cores?: string[]; tom?: string | null };
  perguntas_estrategicas?: string[];
  data_quality?: number;
};

type Briefing = {
  id: string;
  status: "processing" | "completed" | "failed";
  content: BriefingContent | null;
  resumo: string | null;
  data_quality: number | null;
  articles_analyzed: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
};

interface Props {
  marketId: string;
  competitorId: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function QualityBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-success" : value >= 40 ? "bg-amber-500" : "bg-danger";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-text-muted font-medium w-8 text-right">{value}%</span>
    </div>
  );
}

function BriefingContentView({ content, quality }: { content: BriefingContent; quality: number | null }) {
  return (
    <div className="flex flex-col gap-5">
      {quality != null && (
        <div>
          <p className="text-[10px] text-text-muted uppercase mb-1">Qualidade dos dados</p>
          <QualityBar value={quality} />
        </div>
      )}

      <div>
        <p className="text-[10px] text-text-muted uppercase mb-1">Resumo executivo</p>
        <p className="text-[14px] text-text leading-relaxed whitespace-pre-line">{content.resumo_executivo}</p>
      </div>

      {content.visao_geral && (content.visao_geral.fundada || content.visao_geral.sede || content.visao_geral.porte || content.visao_geral.modelo_negocio) && (
        <div className="grid grid-cols-2 gap-2">
          {content.visao_geral.fundada && <div className="p-2 rounded-[8px] bg-background border border-border"><p className="text-[9px] text-text-muted uppercase">Fundada</p><p className="text-[12px] font-medium mt-0.5">{content.visao_geral.fundada}</p></div>}
          {content.visao_geral.sede && <div className="p-2 rounded-[8px] bg-background border border-border"><p className="text-[9px] text-text-muted uppercase">Sede</p><p className="text-[12px] font-medium mt-0.5">{content.visao_geral.sede}</p></div>}
          {content.visao_geral.porte && <div className="p-2 rounded-[8px] bg-background border border-border"><p className="text-[9px] text-text-muted uppercase">Porte</p><p className="text-[12px] font-medium mt-0.5">{content.visao_geral.porte}</p></div>}
          {content.visao_geral.modelo_negocio && <div className="p-2 rounded-[8px] bg-background border border-border"><p className="text-[9px] text-text-muted uppercase">Modelo</p><p className="text-[12px] font-medium mt-0.5">{content.visao_geral.modelo_negocio}</p></div>}
        </div>
      )}

      {content.produtos?.length ? (
        <div>
          <p className="text-[10px] text-text-muted uppercase mb-1.5 flex items-center gap-1"><Building2 className="w-3 h-3" /> Produtos/Ofertas</p>
          <ul className="text-[12px] text-text space-y-1">
            {content.produtos.map((p, i) => <li key={i}>• {p}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {content.pontos_fortes?.length ? (
          <div className="p-3 rounded-[10px] bg-success/5 border border-success/20">
            <p className="text-[10px] text-success uppercase font-medium mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3" /> Pontos fortes</p>
            <ul className="text-[12px] space-y-1">
              {content.pontos_fortes.map((p, i) => <li key={i} className="flex gap-1.5"><CheckCircle2 className="w-3 h-3 text-success mt-0.5 shrink-0" /><span>{p}</span></li>)}
            </ul>
          </div>
        ) : null}
        {content.pontos_fracos?.length ? (
          <div className="p-3 rounded-[10px] bg-danger/5 border border-danger/20">
            <p className="text-[10px] text-danger uppercase font-medium mb-1.5 flex items-center gap-1"><Shield className="w-3 h-3" /> Pontos fracos</p>
            <ul className="text-[12px] space-y-1">
              {content.pontos_fracos.map((p, i) => <li key={i} className="flex gap-1.5"><AlertCircle className="w-3 h-3 text-danger mt-0.5 shrink-0" /><span>{p}</span></li>)}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {content.oportunidades?.length ? (
          <div className="p-3 rounded-[10px] bg-primary/5 border border-primary/20">
            <p className="text-[10px] text-primary uppercase font-medium mb-1.5 flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Oportunidades</p>
            <ul className="text-[12px] space-y-1">{content.oportunidades.map((p, i) => <li key={i}>• {p}</li>)}</ul>
          </div>
        ) : null}
        {content.ameacas?.length ? (
          <div className="p-3 rounded-[10px] bg-amber-500/5 border border-amber-500/20">
            <p className="text-[10px] uppercase font-medium mb-1.5 flex items-center gap-1 text-amber-500"><Target className="w-3 h-3" /> Ameaças</p>
            <ul className="text-[12px] space-y-1">{content.ameacas.map((p, i) => <li key={i}>• {p}</li>)}</ul>
          </div>
        ) : null}
      </div>

      {content.posicionamento && (
        <div>
          <p className="text-[10px] text-text-muted uppercase mb-1">Posicionamento</p>
          <p className="text-[13px] text-text leading-relaxed whitespace-pre-line">{content.posicionamento}</p>
        </div>
      )}

      {content.movimentos_recentes?.length ? (
        <div>
          <p className="text-[10px] text-text-muted uppercase mb-1.5">Movimentos recentes</p>
          <ul className="text-[13px] space-y-1">{content.movimentos_recentes.map((m, i) => <li key={i}>• {m}</li>)}</ul>
        </div>
      ) : null}

      {content.lideranca?.length ? (
        <div>
          <p className="text-[10px] text-text-muted uppercase mb-1.5">Liderança</p>
          <ul className="text-[13px] space-y-0.5">{content.lideranca.map((m, i) => <li key={i}>• {m}</li>)}</ul>
        </div>
      ) : null}

      {(content.identidade_visual?.cores?.length || content.identidade_visual?.tom) && (
        <div className="p-3 rounded-[10px] border border-border">
          <p className="text-[10px] text-text-muted uppercase mb-2 flex items-center gap-1"><Palette className="w-3 h-3" /> Identidade visual</p>
          {content.identidade_visual.cores?.length ? (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {content.identidade_visual.cores.map((hex) => (
                <div key={hex} className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-[6px] border border-border" style={{ backgroundColor: hex }} />
                  <span className="text-[10px] font-mono text-text-muted">{hex}</span>
                </div>
              ))}
            </div>
          ) : null}
          {content.identidade_visual.tom && <p className="text-[12px] text-text-secondary"><span className="text-text font-medium">Tom:</span> {content.identidade_visual.tom}</p>}
        </div>
      )}

      {content.perguntas_estrategicas?.length ? (
        <div>
          <p className="text-[10px] text-text-muted uppercase mb-1.5 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Perguntas estratégicas</p>
          <ul className="text-[13px] space-y-1">{content.perguntas_estrategicas.map((q, i) => <li key={i} className="flex gap-1.5"><span className="text-primary font-semibold">{i + 1}.</span><span>{q}</span></li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}

export function CompetitorBriefingCard({ marketId, competitorId }: Props) {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/markets/${marketId}/competitors/${competitorId}/briefing`);
    if (res.ok) {
      const data: Briefing[] = await res.json();
      setBriefings(data);
      if (data.length > 0 && expandedId === null) setExpandedId(data[0].id);
    }
    setLoading(false);
  }, [marketId, competitorId, expandedId]);

  useEffect(() => { load(); }, [load]);

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/markets/${marketId}/competitors/${competitorId}/briefing`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erro (${res.status})`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  const latest = briefings[0];
  const hasCompleted = briefings.some((b) => b.status === "completed");

  return (
    <div className="rounded-[14px] border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="text-[13px] font-semibold">Briefing competitivo</h3>
          {latest && (
            <span className="text-[10px] text-text-muted ml-2">
              {briefings.length} execução{briefings.length > 1 ? "ões" : ""}
            </span>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className={`h-8 px-3 flex items-center gap-1.5 rounded-full text-[12px] font-medium transition-all ${
            generating ? "bg-background text-text-muted" : "bg-primary text-white hover:bg-primary-hover"
          }`}
        >
          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {generating ? "Gerando..." : hasCompleted ? "Atualizar" : "Gerar briefing"}
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 bg-danger/10 border-b border-danger/20">
          <p className="text-[12px] text-danger font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="px-4 py-8 text-center text-[13px] text-text-muted">Carregando...</div>
      ) : briefings.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <FileText className="w-8 h-8 text-text-muted/40 mx-auto mb-2" />
          <p className="text-[13px] text-text-secondary">Nenhum briefing ainda.</p>
          <p className="text-[11px] text-text-muted mt-1">Gere o primeiro para ter visão estruturada sobre este concorrente.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {briefings.map((b) => {
            const isExpanded = expandedId === b.id;
            return (
              <div key={b.id} className="border-b border-border last:border-b-0">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : b.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-background/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {b.status === "completed" && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
                    {b.status === "processing" && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />}
                    {b.status === "failed" && <AlertCircle className="w-4 h-4 text-danger shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium">{formatDate(b.created_at)}</p>
                      <p className="text-[10px] text-text-muted">
                        {b.status === "completed" && `${b.articles_analyzed} artigos · qualidade ${b.data_quality ?? "-"}%`}
                        {b.status === "processing" && "Em processamento..."}
                        {b.status === "failed" && (b.error || "Falhou")}
                      </p>
                    </div>
                  </div>
                </button>
                {isExpanded && b.status === "completed" && b.content && (
                  <div className="px-4 pb-4">
                    <BriefingContentView content={b.content} quality={b.data_quality} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
