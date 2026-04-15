"use client";

import { useState } from "react";
import { Sparkles, Loader2, X, Plus, Rss, Globe } from "lucide-react";
import { Input } from "@/components/ui/Input";

export type SourceDraft = {
  name: string;
  url: string;
  source_type: "rss" | "web";
  ai_suggested?: boolean;
};

interface Props {
  marketName: string;
  subtopics: string[];
  language: string;
  sources: SourceDraft[];
  onChange: (v: SourceDraft[]) => void;
}

export function MarketStepSources({ marketName, subtopics, language, sources, onChange }: Props) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"rss" | "web">("web");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SourceDraft[]>([]);

  function add(s: SourceDraft) {
    if (!s.name.trim() || !s.url.trim()) return;
    if (sources.some((x) => x.url === s.url)) return;
    onChange([...sources, s]);
  }

  function remove(idx: number) {
    onChange(sources.filter((_, i) => i !== idx));
  }

  async function handleSuggest() {
    if (!marketName.trim() || suggesting) return;
    setSuggesting(true);
    try {
      const res = await fetch("/api/markets/suggest-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketName, subtopics, language }),
      });
      const data = await res.json();
      const list: SourceDraft[] = Array.isArray(data.suggestions) ? data.suggestions : [];
      const fresh = list
        .filter((s) => !sources.some((x) => x.url === s.url))
        .map((s) => ({ ...s, ai_suggested: true }));
      setSuggestions(fresh);
    } finally {
      setSuggesting(false);
    }
  }

  function addSuggestion(s: SourceDraft) {
    add(s);
    setSuggestions((prev) => prev.filter((x) => x.url !== s.url));
  }

  function handleManualAdd() {
    if (!name.trim() || !url.trim()) return;
    add({ name: name.trim(), url: url.trim(), source_type: type, ai_suggested: false });
    setName("");
    setUrl("");
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[22px] font-bold tracking-tight">Fontes (opcional)</h2>
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
          Se quiser restringir a busca a fontes específicas. Se pular, a IA decide as fontes na coleta.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto_auto] gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://fonte.com/feed" />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "rss" | "web")}
          className="h-10 px-3 rounded-[10px] bg-surface border border-border text-[13px]"
        >
          <option value="web">Web</option>
          <option value="rss">RSS</option>
        </select>
        <button
          type="button"
          onClick={handleManualAdd}
          disabled={!name.trim() || !url.trim()}
          className="h-10 px-4 rounded-[10px] bg-primary text-white text-[13px] font-medium flex items-center gap-1.5 disabled:opacity-40 hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {sources.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {sources.map((s, i) => (
            <div key={`${s.url}-${i}`} className="flex items-center gap-2 p-2.5 rounded-[10px] bg-surface border border-border">
              {s.source_type === "rss" ? <Rss className="w-4 h-4 text-text-muted shrink-0" /> : <Globe className="w-4 h-4 text-text-muted shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{s.name}</p>
                <p className="text-[11px] text-text-muted truncate">{s.url}</p>
              </div>
              {s.ai_suggested && (
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">Sugestões da IA</p>
          <div className="flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.url}
                type="button"
                onClick={() => addSuggestion(s)}
                className="text-left flex items-start gap-2 p-2.5 rounded-[10px] border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <Plus className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                {s.source_type === "rss" ? <Rss className="w-4 h-4 text-text-muted mt-0.5" /> : <Globe className="w-4 h-4 text-text-muted mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium">{s.name}</p>
                  <p className="text-[11px] text-text-muted truncate">{s.url}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
