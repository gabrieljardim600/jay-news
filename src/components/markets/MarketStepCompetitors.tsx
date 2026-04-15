"use client";

import { useState } from "react";
import { Sparkles, Loader2, X, Plus, Building2 } from "lucide-react";
import { Input } from "@/components/ui/Input";

export type CompetitorDraft = {
  name: string;
  website: string;
  description?: string;
  ai_suggested?: boolean;
};

interface Props {
  marketName: string;
  subtopics: string[];
  language: string;
  competitors: CompetitorDraft[];
  onChange: (v: CompetitorDraft[]) => void;
}

export function MarketStepCompetitors({ marketName, subtopics, language, competitors, onChange }: Props) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<CompetitorDraft[]>([]);

  function add(c: CompetitorDraft) {
    if (!c.name.trim()) return;
    if (competitors.some((x) => x.name.toLowerCase() === c.name.toLowerCase())) return;
    onChange([...competitors, c]);
  }

  function remove(idx: number) {
    onChange(competitors.filter((_, i) => i !== idx));
  }

  async function handleSuggest() {
    if (!marketName.trim() || suggesting) return;
    setSuggesting(true);
    try {
      const res = await fetch("/api/markets/suggest-competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketName, subtopics, language }),
      });
      const data = await res.json();
      const list: CompetitorDraft[] = Array.isArray(data.suggestions) ? data.suggestions : [];
      const fresh = list
        .filter((s) => !competitors.some((c) => c.name.toLowerCase() === s.name.toLowerCase()))
        .map((s) => ({ ...s, ai_suggested: true }));
      setSuggestions(fresh);
    } finally {
      setSuggesting(false);
    }
  }

  function addSuggestion(s: CompetitorDraft) {
    add(s);
    setSuggestions((prev) => prev.filter((x) => x.name !== s.name));
  }

  function handleManualAdd() {
    if (!name.trim()) return;
    add({ name: name.trim(), website: website.trim(), ai_suggested: false });
    setName("");
    setWebsite("");
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[22px] font-bold tracking-tight">Concorrentes</h2>
          <button
            type="button"
            onClick={handleSuggest}
            disabled={!marketName.trim() || suggesting}
            className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Sugerir com IA
          </button>
        </div>
        <p className="text-text-secondary text-[14px]">
          Adicione empresas para monitorar. Website opcional (ajuda na busca).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da empresa" />
        <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://site.com.br" />
        <button
          type="button"
          onClick={handleManualAdd}
          disabled={!name.trim()}
          className="h-10 px-4 rounded-[10px] bg-primary text-white text-[13px] font-medium flex items-center gap-1.5 disabled:opacity-40 hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {competitors.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {competitors.map((c, i) => (
            <div key={`${c.name}-${i}`} className="flex items-center gap-2 p-2.5 rounded-[10px] bg-surface border border-border">
              <Building2 className="w-4 h-4 text-text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{c.name}</p>
                {c.website && <p className="text-[11px] text-text-muted truncate">{c.website}</p>}
              </div>
              {c.ai_suggested && (
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">IA</span>
              )}
              <button type="button" onClick={() => remove(i)} className="text-text-muted hover:text-danger transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
            Sugestões da IA — {marketName}
          </p>
          <div className="flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => addSuggestion(s)}
                className="text-left flex items-start gap-2 p-2.5 rounded-[10px] border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <Plus className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium">{s.name}</p>
                  {s.website && <p className="text-[11px] text-text-muted truncate">{s.website}</p>}
                  {s.description && <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-2">{s.description}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-[12px] text-text-muted">Opcional — você pode pular e adicionar concorrentes depois.</p>
    </div>
  );
}
