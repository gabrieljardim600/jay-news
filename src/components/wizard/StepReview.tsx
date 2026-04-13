"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { WeightStars } from "./WeightStars";
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
  executive: "Executivo (2-3 frases)",
  detailed: "Detalhado (4-5 frases)",
};

export function StepReview({
  name, icon, color, interests, sources,
  language, summaryStyle, digestTime, maxArticles, exclusions,
}: StepReviewProps) {
  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto">
      <div>
        <h2 className="text-xl font-bold mb-1">Revisao</h2>
        <p className="text-text-secondary text-sm mb-4">Confira tudo antes de criar o digest.</p>
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{icon}</span>
          <div>
            <p className="text-lg font-bold">{name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-text-muted">cor do digest</span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-2 text-sm text-text-secondary uppercase tracking-wide">
          Interesses ({interests.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {interests.map((interest) => (
            <Badge key={interest}>{interest}</Badge>
          ))}
          {interests.length === 0 && <p className="text-text-muted text-sm">Nenhum interesse adicionado</p>}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-2 text-sm text-text-secondary uppercase tracking-wide">
          Fontes ({sources.length})
        </h3>
        {sources.length === 0 && <p className="text-text-muted text-sm">Nenhuma fonte adicionada</p>}
        <div className="flex flex-col gap-2">
          {sources.map((source, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Badge
                  className={source.testResult?.status === "success"
                    ? "bg-success/20 text-success shrink-0"
                    : "bg-border/30 text-text-muted shrink-0"
                  }
                >
                  {source.testResult?.status === "success" ? "OK" : "?"}
                </Badge>
                <span className="text-sm truncate">{source.name}</span>
                {source.interest && (
                  <span className="text-xs text-text-muted shrink-0">({source.interest})</span>
                )}
              </div>
              <WeightStars value={source.weight} onChange={() => {}} size="sm" readOnly />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-3 text-sm text-text-secondary uppercase tracking-wide">
          Preferencias
        </h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-text-secondary">Idioma:</span>
          <span>{LANG_LABEL[language] || language}</span>
          <span className="text-text-secondary">Estilo:</span>
          <span>{STYLE_LABEL[summaryStyle] || summaryStyle}</span>
          <span className="text-text-secondary">Horario:</span>
          <span>{digestTime}</span>
          <span className="text-text-secondary">Max artigos:</span>
          <span>{maxArticles}</span>
          {exclusions.length > 0 && (
            <>
              <span className="text-text-secondary">Exclusoes:</span>
              <span className="truncate">{exclusions.join(", ")}</span>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
