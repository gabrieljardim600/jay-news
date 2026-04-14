"use client";

import { Card } from "@/components/ui/Card";
import { WeightStars } from "./WeightStars";
import { Rss, Globe, Check } from "lucide-react";
import type { WizardSource } from "./StepSources";

interface StepReviewProps {
  name: string;
  icon: string;
  color: string;
  interests: string[];
  sources: WizardSource[];
  language: string;
  summaryStyle: string;
  digestTime: string;
  maxArticles: number;
  exclusions: string[];
}

const LANG_LABEL: Record<string, string> = {
  "pt-BR": "Portugues (BR)",
  en: "English",
  es: "Espanol",
};

const STYLE_LABEL: Record<string, string> = {
  executive: "Executivo",
  detailed: "Detalhado",
  complete: "Completo",
};

export function StepReview({
  name, icon, color, interests, sources,
  language, summaryStyle, digestTime, maxArticles, exclusions,
}: StepReviewProps) {
  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto">
      <div>
        <h2 className="text-[22px] font-bold mb-1 tracking-tight">Tudo certo?</h2>
        <p className="text-text-secondary text-[14px]">Confira antes de criar.</p>
      </div>

      {/* Identity */}
      <Card className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-[14px] flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${color}15` }}
        >
          {icon}
        </div>
        <div>
          <p className="text-[17px] font-semibold">{name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[12px] text-text-muted">{interests.length} interesses · {sources.length} fontes</span>
          </div>
        </div>
      </Card>

      {/* Interests */}
      <Card>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-3">
          Interesses
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {interests.map((interest) => (
            <span key={interest} className="text-[13px] font-medium bg-surface px-3 py-1 rounded-full text-text-secondary">
              {interest}
            </span>
          ))}
        </div>
      </Card>

      {/* Sources */}
      {sources.length > 0 && (
        <Card>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-3">
            Fontes
          </h3>
          <div className="flex flex-col gap-1.5">
            {sources.map((source, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {source.testResult?.status === "success" ? (
                    <Check className="w-3.5 h-3.5 text-success shrink-0" />
                  ) : source.source_type === "rss" ? (
                    <Rss className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  )}
                  <span className="text-[13px] text-text truncate">{source.name}</span>
                  {source.interest && (
                    <span className="text-[11px] text-text-muted shrink-0">({source.interest})</span>
                  )}
                </div>
                <WeightStars value={source.weight} onChange={() => {}} size="sm" readOnly />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Preferences */}
      <Card>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-3">
          Configuracao
        </h3>
        <div className="grid grid-cols-2 gap-y-2 text-[13px]">
          <span className="text-text-secondary">Idioma</span>
          <span className="text-text">{LANG_LABEL[language] || language}</span>
          <span className="text-text-secondary">Estilo</span>
          <span className="text-text">{STYLE_LABEL[summaryStyle] || summaryStyle}</span>
          <span className="text-text-secondary">Horario</span>
          <span className="text-text">{digestTime}</span>
          <span className="text-text-secondary">Max artigos</span>
          <span className="text-text">{maxArticles}</span>
          {exclusions.length > 0 && (
            <>
              <span className="text-text-secondary">Exclusoes</span>
              <span className="text-text truncate">{exclusions.join(", ")}</span>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
