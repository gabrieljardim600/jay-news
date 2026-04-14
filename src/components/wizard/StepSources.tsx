"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { WeightStars } from "./WeightStars";
import { SourceTestCard } from "./SourceTestCard";
import { SourceSuggestions } from "@/components/settings/SourceSuggestions";
import type { SourceTestResult } from "@/types";

export interface WizardSource {
  name: string;
  url: string;
  source_type: "rss" | "web";
  weight: number;
  interest: string | null;
  testResult: SourceTestResult | null;
}

interface SourceAdderProps {
  interest: string | null;
  onAdd: (source: WizardSource) => void;
}

function SourceAdder({ interest, onAdd }: SourceAdderProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<"rss" | "web">("rss");
  const [weight, setWeight] = useState(3);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SourceTestResult | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function handleTest() {
    if (!url.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/sources/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), source_type: sourceType }),
      });
      const result: SourceTestResult = await res.json();
      setTestResult(result);
      if (result.status === "success" && result.feed_name && !name) {
        setName(result.feed_name);
      }
    } finally {
      setTesting(false);
    }
  }

  function handleConfirm() {
    onAdd({ name: name.trim(), url: url.trim(), source_type: sourceType, weight, interest, testResult });
    setUrl("");
    setName("");
    setSourceType("rss");
    setWeight(3);
    setTestResult(null);
    setShowForm(false);
  }

  if (!showForm) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShowForm(true)} className="mt-2">
        + Adicionar fonte
      </Button>
    );
  }

  return (
    <div className="mt-2 p-3 bg-surface rounded-md border border-border">
      <div className="flex gap-1 p-0.5 rounded-md bg-background border border-border mb-3">
        <button
          type="button"
          onClick={() => { setSourceType("rss"); setTestResult(null); }}
          className={`flex-1 py-1 px-2 text-xs rounded font-medium transition-colors ${
            sourceType === "rss"
              ? "bg-primary text-white"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          RSS Feed
        </button>
        <button
          type="button"
          onClick={() => { setSourceType("web"); setTestResult(null); }}
          className={`flex-1 py-1 px-2 text-xs rounded font-medium transition-colors ${
            sourceType === "web"
              ? "bg-primary text-white"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Website
        </button>
      </div>
      <div className="flex gap-2 items-end mb-2">
        <Input
          label={sourceType === "web" ? "Dominio do site" : "URL do RSS"}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={sourceType === "web" ? "dnews.com.br" : "https://example.com/rss"}
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleTest()}
        />
        <Button size="sm" onClick={handleTest} loading={testing} disabled={!url.trim()} className="mb-0.5">
          Testar
        </Button>
      </div>
      {sourceType === "web" && (
        <p className="text-xs text-text-muted mb-2">
          Busca avancada via Tavily — funciona com sites sem RSS
        </p>
      )}

      {testResult && <SourceTestCard result={testResult} />}

      {testResult?.status === "success" && (
        <div className="flex flex-col gap-3 mt-3">
          <Input
            label="Nome da fonte"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={sourceType === "web" ? "Ex: Dnews" : "Ex: TechCrunch"}
          />
          <div className="flex items-center justify-between">
            <label className="text-sm text-text-secondary font-medium">Peso (influencia na selecao)</label>
            <WeightStars value={weight} onChange={setWeight} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setTestResult(null); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={!name.trim()}>
              Confirmar
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

  function handleSuggestionAdd(suggestion: {
    name: string;
    url: string;
    topic_name: string | null;
  }) {
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
      <SourceSuggestions interests={interests} onAdd={handleSuggestionAdd} />
      <div>
        <h2 className="text-xl font-bold mb-1">Adicione suas fontes</h2>
        <p className="text-text-secondary text-sm">
          Adicione feeds RSS ou websites por interesse. Teste antes de confirmar. Fontes sem interesse ficam em &quot;Fontes gerais&quot;.
        </p>
      </div>

      {sections.map((section) => {
        const sectionSources = sources.filter((s) => s.interest === section.key);
        return (
          <Card key={String(section.key)}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{section.label}</h3>
              <span className="text-xs text-text-muted">
                {sectionSources.length} fonte{sectionSources.length !== 1 ? "s" : ""}
              </span>
            </div>

            {sectionSources.map((source) => {
              const globalIndex = sources.indexOf(source);
              return (
                <div key={globalIndex} className="flex items-center justify-between p-2 rounded bg-surface mb-1">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium text-sm truncate">{source.name}</span>
                    <span className="text-xs text-text-muted truncate">{source.url}</span>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <WeightStars value={source.weight} onChange={(w) => updateWeight(globalIndex, w)} size="sm" />
                    <button
                      type="button"
                      onClick={() => removeSource(globalIndex)}
                      className="text-text-muted hover:text-danger transition-colors text-sm"
                    >
                      ✕
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
