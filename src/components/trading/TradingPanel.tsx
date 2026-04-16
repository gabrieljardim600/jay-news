"use client";

import { Globe, MapPin, Lightbulb, Clock, Eye } from "lucide-react";
import type { TradingBrief } from "@/lib/trading/types";
import { BulletSection } from "./BulletSection";
import { AgendaTable } from "./AgendaTable";
import { SentimentCard } from "./SentimentCard";

export function TradingPanel({ brief }: { brief: TradingBrief }) {
  const isMorning = brief.edition === "morning";
  return (
    <div className="flex flex-col gap-3">
      {isMorning ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <BulletSection
              title="Cenário global"
              icon={Globe}
              accent="text-sky-500 bg-sky-500/10"
              bullets={brief.global_bullets}
            />
            <BulletSection
              title="Cenário Brasil"
              icon={MapPin}
              accent="text-emerald-500 bg-emerald-500/10"
              bullets={brief.brasil_bullets}
            />
          </div>
          <AgendaTable events={brief.agenda} />
          <SentimentCard sentiment={brief.sentiment} />
          {brief.take && (
            <div className="p-4 rounded-[14px] border-2 border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-primary" />
                <h3 className="text-[13px] font-semibold">Contexto do dia</h3>
              </div>
              <p className="text-[14px] text-text leading-relaxed">{brief.take}</p>
            </div>
          )}
        </>
      ) : (
        <>
          <BulletSection
            title="O que aconteceu"
            icon={Clock}
            accent="text-amber-500 bg-amber-500/10"
            bullets={brief.happened_bullets ?? []}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <BulletSection
              title="Fechamento global"
              icon={Globe}
              accent="text-sky-500 bg-sky-500/10"
              bullets={brief.global_bullets}
            />
            <BulletSection
              title="Fechamento Brasil"
              icon={MapPin}
              accent="text-emerald-500 bg-emerald-500/10"
              bullets={brief.brasil_bullets}
            />
          </div>
          {brief.agenda_review && (
            <div className="p-4 rounded-[14px] border border-border bg-surface">
              <h3 className="text-[13px] font-semibold mb-2">Agenda — review</h3>
              <p className="text-[13px] text-text leading-relaxed">{brief.agenda_review}</p>
            </div>
          )}
          <SentimentCard sentiment={brief.sentiment} />
          {brief.overnight && (
            <div className="p-4 rounded-[14px] border border-border bg-surface">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-3.5 h-3.5 text-text-muted" />
                <h3 className="text-[13px] font-semibold">O que assistir no overnight</h3>
              </div>
              <p className="text-[13px] text-text leading-relaxed">{brief.overnight}</p>
            </div>
          )}
          {brief.closing_take && (
            <div className="p-4 rounded-[14px] border-2 border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-primary" />
                <h3 className="text-[13px] font-semibold">Fechamento</h3>
              </div>
              <p className="text-[14px] text-text leading-relaxed">{brief.closing_take}</p>
            </div>
          )}
        </>
      )}

      <p className="text-[10px] text-text-muted text-center mt-2">
        {brief.model_used} · {(brief.duration_ms / 1000).toFixed(1)}s · {brief.date} · {brief.edition}
      </p>
    </div>
  );
}
