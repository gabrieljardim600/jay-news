"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { WeightStars } from "./WeightStars";
import { SourceSuggestions } from "@/components/settings/SourceSuggestions";
import { Globe, Rss, Check, AlertCircle, Loader2, X, Link2 } from "lucide-react";
import type { SourceTestResult } from "@/types";

export interface WizardSource {
  name: string;
  url: string;
  source_type: "rss" | "web";
  weight: number;
  interest: string | null;
  testResult: SourceTestResult | null;
}

function normalizeUrl(input: string): string {
  let url = input.trim();
  // Remove trailing slashes
  url = url.replace(/\/+$/, "");
  // Add protocol if missing
  if (!url.match(/^https?:\/\//i)) {
    url = `https://${url}`;
  }
  // Fix common typos
  url = url.replace(/^https?:\/\/(?:ww\.|wwww\.)/i, (match) => match.replace(/ww\.|wwww\./, "www."));
  return url;
}

function extractDisplayName(url: string): string {
  try {
    const hostname = new URL(normalizeUrl(url)).hostname.replace(/^www\./, "");
    // Capitalize first letter of domain name
    const parts = hostname.split(".");
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch {
    return url;
  }
}

interface SourceAdderProps {
  interest: string | null;
  onAdd: (source: WizardSource) => void;
}

function SourceAdder({ interest, onAdd }: SourceAdderProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [weight, setWeight] = useState(3);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SourceTestResult | null>(null);
  const [detectedType, setDetectedType] = useState<"rss" | "web" | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function handleValidate() {
    const input = url.trim();
    if (!input) return;

    setTesting(true);
    setTestResult(null);
    setDetectedType(null);

    const normalized = normalizeUrl(input);

    // Try RSS first
    try {
      const rssRes = await fetch("/api/sources/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized, source_type: "rss" }),
      });
      const rssResult: SourceTestResult = await rssRes.json();

      if (rssResult.status === "success") {
        setTestResult(rssResult);
        setDetectedType("rss");
        if (rssResult.feed_name && !name) setName(rssResult.feed_name);
        setTesting(false);
        return;
      }
    } catch { /* try web fallback */ }

    // Fallback to web/domain search
    try {
      const webRes = await fetch("/api/sources/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized, source_type: "web" }),
      });
      const webResult: SourceTestResult = await webRes.json();
      setTestResult(webResult);
      setDetectedType("web");
      if (webResult.status === "success" && !name) {
        setName(webResult.feed_name || extractDisplayName(input));
      }
    } catch {
      setTestResult({
        status: "error",
        error_code: "NETWORK",
        error_message: "Erro de conexao. Verifique o endereco e tente novamente.",
      });
    }

    setTesting(false);
  }

  function handleConfirm() {
    const normalized = normalizeUrl(url.trim());
    onAdd({
      name: name.trim() || extractDisplayName(url),
      url: detectedType === "web" ? normalized.replace(/^https?:\/\//, "").replace(/^www\./, "") : normalized,
      source_type: detectedType || "web",
      weight,
      interest,
      testResult,
    });
    setUrl("");
    setName("");
    setWeight(3);
    setTestResult(null);
    setDetectedType(null);
    setShowForm(false);
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="mt-2 flex items-center gap-2 text-[13px] text-primary font-medium hover:underline"
      >
        <Link2 className="w-3.5 h-3.5" />
        Adicionar fonte
      </button>
    );
  }

  return (
    <div className="mt-3 bg-surface rounded-[12px] border border-border p-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-[13px] text-text-secondary font-medium mb-1.5 block">
            Cole o link do site ou feed RSS
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleValidate()}
            placeholder="exemplo.com.br ou https://site.com/rss"
            className="w-full bg-background border border-border rounded-[10px] px-3.5 py-2.5 text-[14px] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
          <p className="text-[11px] text-text-muted mt-1.5">
            Detectamos automaticamente se e RSS ou site. Sem necessidade de HTTPS.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleValidate}
          loading={testing}
          disabled={!url.trim()}
          className="mb-0.5 rounded-[8px]"
        >
          {testing ? "Verificando..." : "Verificar"}
        </Button>
      </div>

      {/* Testing indicator */}
      {testing && (
        <div className="flex items-center gap-2 mt-3 text-[13px] text-text-secondary">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Verificando o site... tentando RSS, depois busca web
        </div>
      )}

      {/* Result */}
      {testResult && !testing && (
        <div className={`mt-3 rounded-[10px] p-3 ${
          testResult.status === "success"
            ? "bg-success/8 border border-success/15"
            : "bg-danger/8 border border-danger/15"
        }`}>
          {testResult.status === "success" ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-success" />
                <span className="text-[13px] font-medium text-text">
                  {testResult.feed_name || extractDisplayName(url)}
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-surface text-text-muted font-medium">
                  {detectedType === "rss" ? (
                    <span className="flex items-center gap-1"><Rss className="w-3 h-3" /> RSS</span>
                  ) : (
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Web</span>
                  )}
                </span>
                <span className="text-[11px] text-text-muted">
                  {testResult.total_articles} artigos
                </span>
              </div>
              {testResult.sample_articles && testResult.sample_articles.length > 0 && (
                <div className="flex flex-col gap-1 pl-6">
                  {testResult.sample_articles.map((a, i) => (
                    <p key={i} className="text-[12px] text-text-secondary truncate">
                      {a.title}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-medium text-text">{testResult.error_code}</p>
                <p className="text-[12px] text-text-secondary">{testResult.error_message}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm form */}
      {testResult?.status === "success" && (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <label className="text-[13px] text-text-secondary font-medium mb-1.5 block">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-background border border-border rounded-[10px] px-3.5 py-2.5 text-[14px] text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-text-secondary font-medium">Relevancia</span>
            <WeightStars value={weight} onChange={setWeight} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setTestResult(null); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={!name.trim()} className="rounded-[8px]">
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {/* Add anyway for errors */}
      {testResult?.status === "error" && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[12px] text-text-muted">Ainda assim deseja adicionar?</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setTestResult(null); }}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTestResult({ status: "success", feed_name: extractDisplayName(url), total_articles: 0 });
                setDetectedType("web");
                if (!name) setName(extractDisplayName(url));
              }}
              className="rounded-[8px]"
            >
              Adicionar mesmo assim
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface StepSourcesProps {
  interests: string[];
  sources: WizardSource[];
  onSourcesChange: (sources: WizardSource[]) => void;
}

export function StepSources({ interests, sources, onSourcesChange }: StepSourcesProps) {
  function addSource(source: WizardSource) {
    onSourcesChange([...sources, source]);
  }

  function removeSource(index: number) {
    onSourcesChange(sources.filter((_, i) => i !== index));
  }

  function updateWeight(index: number, weight: number) {
    const updated = [...sources];
    updated[index] = { ...updated[index], weight };
    onSourcesChange(updated);
  }

  function handleSuggestionAdd(suggestion: { name: string; url: string; topic_name: string | null }) {
    addSource({
      name: suggestion.name,
      url: suggestion.url,
      source_type: "rss",
      weight: 3,
      interest: suggestion.topic_name,
      testResult: null,
    });
  }

  const sections = [
    ...interests.map((interest) => ({ label: interest, key: interest as string | null })),
    { label: "Fontes gerais", key: null as string | null },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto">
      <div>
        <h2 className="text-[22px] font-bold mb-1 tracking-tight">Suas fontes</h2>
        <p className="text-text-secondary text-[14px] leading-relaxed">
          Cole o link de qualquer site ou feed RSS. Detectamos automaticamente o melhor metodo de busca.
        </p>
      </div>

      <SourceSuggestions interests={interests} onAdd={handleSuggestionAdd} />

      {sections.map((section) => {
        const sectionSources = sources.filter((s) => s.interest === section.key);
        return (
          <Card key={String(section.key)}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold">{section.label}</h3>
              <span className="text-[11px] text-text-muted font-medium">
                {sectionSources.length} fonte{sectionSources.length !== 1 ? "s" : ""}
              </span>
            </div>

            {sectionSources.map((source) => {
              const globalIndex = sources.indexOf(source);
              return (
                <div key={globalIndex} className="flex items-center justify-between p-2.5 rounded-[10px] bg-surface mb-1.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 ${
                      source.source_type === "rss" ? "bg-primary/10" : "bg-secondary/10"
                    }`}>
                      {source.source_type === "rss"
                        ? <Rss className="w-3.5 h-3.5 text-primary" />
                        : <Globe className="w-3.5 h-3.5 text-secondary" />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[13px] font-medium text-text block truncate">{source.name}</span>
                      <span className="text-[11px] text-text-muted block truncate">{source.url}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <WeightStars value={source.weight} onChange={(w) => updateWeight(globalIndex, w)} size="sm" />
                    <button
                      type="button"
                      onClick={() => removeSource(globalIndex)}
                      className="w-6 h-6 flex items-center justify-center rounded-full text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            <SourceAdder interest={section.key} onAdd={addSource} />
          </Card>
        );
      })}
    </div>
  );
}
