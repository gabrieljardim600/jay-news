"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Check, ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/ui/AppHeader";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ChipInput } from "@/components/ui/ChipInput";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SOURCE_TEMPLATES, type SourceTemplate } from "@/lib/gossip/templates";
import type { GossipTopicType } from "@/lib/gossip/types";

const TYPE_OPTIONS: Array<{ value: GossipTopicType; label: string }> = [
  { value: "person", label: "Pessoa" },
  { value: "couple", label: "Casal" },
  { value: "event", label: "Evento" },
  { value: "show", label: "Programa / Show" },
  { value: "brand", label: "Marca" },
];

type TabKey = "br" | "int" | "community";

interface DraftTopic {
  type: GossipTopicType;
  name: string;
  aliases: string[];
  priority: number;
}

const MAX_TOPICS = 5;
const MIN_SOURCES = 3;

function templateKey(t: SourceTemplate): string {
  return `${t.platform}:${t.handle}`;
}

function filterTemplates(tab: TabKey): SourceTemplate[] {
  if (tab === "community") {
    return SOURCE_TEMPLATES.filter((t) => t.category === "community");
  }
  if (tab === "br") {
    return SOURCE_TEMPLATES.filter(
      (t) => t.region === "br" && (t.category === "tabloid" || t.category === "video" || t.category === "proxy")
    );
  }
  // int
  return SOURCE_TEMPLATES.filter(
    (t) => t.region === "int" && (t.category === "tabloid" || t.category === "proxy" || t.category === "video")
  );
}

export default function GossipOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [tab, setTab] = useState<TabKey>("br");
  const [selectedHandles, setSelectedHandles] = useState<Set<string>>(new Set());
  const [topics, setTopics] = useState<DraftTopic[]>([]);

  // form state for step 2
  const [type, setType] = useState<GossipTopicType>("person");
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  const [finalizing, setFinalizing] = useState(false);

  const visibleTemplates = useMemo(() => filterTemplates(tab), [tab]);

  function toggleHandle(key: string) {
    setSelectedHandles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSuggestAliases() {
    if (!name.trim() || !type || suggesting) return;
    setSuggesting(true);
    try {
      const res = await fetch("/api/gossip/topics/suggest-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Erro ao sugerir: ${data?.error || `HTTP ${res.status}`}`);
        return;
      }
      const incoming = Array.isArray(data?.aliases) ? (data.aliases as string[]) : [];
      const merged = Array.from(new Set([...aliases, ...incoming.map((a) => a.toLowerCase())]));
      setAliases(merged);
    } catch (err) {
      alert(`Erro de rede: ${(err as Error).message}`);
    } finally {
      setSuggesting(false);
    }
  }

  function addTopic() {
    if (!name.trim()) return;
    if (topics.length >= MAX_TOPICS) {
      alert(`Máximo ${MAX_TOPICS} topics no onboarding.`);
      return;
    }
    setTopics((prev) => [
      ...prev,
      { type, name: name.trim(), aliases: [...aliases], priority: 1 },
    ]);
    setType("person");
    setName("");
    setAliases([]);
  }

  function removeTopic(idx: number) {
    setTopics((prev) => prev.filter((_, i) => i !== idx));
  }

  async function finalize() {
    if (finalizing) return;
    if (topics.length < 1) {
      alert("Adicione pelo menos 1 topic.");
      return;
    }
    if (selectedHandles.size < MIN_SOURCES) {
      alert(`Selecione ao menos ${MIN_SOURCES} fontes.`);
      return;
    }
    setFinalizing(true);

    const selectedTemplates = SOURCE_TEMPLATES.filter((t) => selectedHandles.has(templateKey(t)));

    // best-effort: post sources
    for (const tpl of selectedTemplates) {
      try {
        const res = await fetch("/api/gossip/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: tpl.platform,
            handle: tpl.handle,
            label: tpl.label,
            tier: tpl.tier,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(`Erro ao salvar fonte ${tpl.label}: ${data?.error || `HTTP ${res.status}`}`);
        }
      } catch (err) {
        alert(`Erro de rede ao salvar ${tpl.label}: ${(err as Error).message}`);
      }
    }

    // best-effort: post topics
    for (const tp of topics) {
      try {
        const res = await fetch("/api/gossip/topics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: tp.type,
            name: tp.name,
            aliases: tp.aliases,
            priority: tp.priority,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(`Erro ao salvar topic ${tp.name}: ${data?.error || `HTTP ${res.status}`}`);
        }
      } catch (err) {
        alert(`Erro de rede ao salvar ${tp.name}: ${(err as Error).message}`);
      }
    }

    router.push("/gossip");
  }

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8 pb-20">
      <AppHeader />

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-semibold ${
                step === 1 ? "bg-primary text-white" : "bg-surface text-text-muted"
              }`}
            >
              1
            </span>
            <span className="text-[14px] font-medium">Fontes</span>
          </div>
          <div className="h-px flex-1 bg-border" />
          <div className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-semibold ${
                step === 2 ? "bg-primary text-white" : "bg-surface text-text-muted"
              }`}
            >
              2
            </span>
            <span className="text-[14px] font-medium">Topics</span>
          </div>
        </div>

        {step === 1 ? (
          <section className="flex flex-col gap-5">
            <div>
              <h2 className="text-[20px] font-heading font-bold tracking-tight">Escolha suas fontes</h2>
              <p className="text-[14px] text-text-muted mt-1">
                Marque pelo menos {MIN_SOURCES} fontes para começar. Você pode adicionar/remover depois em Settings.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-surface rounded-[10px] p-1 w-fit">
              {(
                [
                  { k: "br" as TabKey, label: "BR" },
                  { k: "int" as TabKey, label: "Internacional" },
                  { k: "community" as TabKey, label: "Comunidade" },
                ] satisfies Array<{ k: TabKey; label: string }>
              ).map((t) => (
                <button
                  key={t.k}
                  onClick={() => setTab(t.k)}
                  className={`px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-colors ${
                    tab === t.k
                      ? "bg-white dark:bg-bg text-text shadow-sm"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {visibleTemplates.map((tpl) => {
                const key = templateKey(tpl);
                const checked = selectedHandles.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleHandle(key)}
                    className={`flex items-center gap-3 rounded-[10px] border px-4 py-3 text-left transition-all ${
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-border bg-surface hover:border-text-muted/40"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-[5px] flex items-center justify-center border ${
                        checked
                          ? "bg-primary border-primary text-white"
                          : "border-border bg-bg"
                      }`}
                    >
                      {checked ? <Check className="w-3.5 h-3.5" /> : null}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[15px] font-medium truncate">{tpl.label}</span>
                        <Badge variant="default" className="uppercase">
                          {tpl.platform}
                        </Badge>
                        <Badge variant="low">{tpl.tier}</Badge>
                      </div>
                      <div className="text-[12px] text-text-muted truncate mt-0.5">{tpl.handle}</div>
                    </div>
                  </button>
                );
              })}
              {visibleTemplates.length === 0 ? (
                <p className="text-[13px] text-text-muted py-6 text-center">Nenhum template aqui.</p>
              ) : null}
            </div>

            <div className="sticky bottom-4 flex items-center justify-between gap-3 bg-bg/80 backdrop-blur-sm rounded-[12px] border border-border px-4 py-3">
              <span className="text-[13px] text-text-muted">
                {selectedHandles.size}/{MIN_SOURCES} mínimo selecionadas
              </span>
              <Button
                onClick={() => setStep(2)}
                disabled={selectedHandles.size < MIN_SOURCES}
              >
                Continuar
              </Button>
            </div>
          </section>
        ) : (
          <section className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-heading font-bold tracking-tight">Quem você acompanha?</h2>
                <p className="text-[14px] text-text-muted mt-1">
                  Adicione pelo menos 1 topic (até {MAX_TOPICS}). Você edita depois em Settings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
              <div className="flex flex-col gap-4">
                <Select
                  label="Tipo"
                  value={type}
                  onChange={(e) => setType(e.target.value as GossipTopicType)}
                  options={TYPE_OPTIONS}
                />
                <Input
                  label="Nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Anitta"
                />
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[13px] text-text-secondary font-medium">
                      Aliases (digite e Enter)
                    </label>
                    <button
                      type="button"
                      onClick={handleSuggestAliases}
                      disabled={!name.trim() || !type || suggesting}
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {suggesting ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Sugerindo...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Sugerir aliases
                        </>
                      )}
                    </button>
                  </div>
                  <ChipInput
                    values={aliases}
                    onChange={setAliases}
                    placeholder="ex: larissa machado, anittona"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addTopic}
                    disabled={!name.trim() || topics.length >= MAX_TOPICS}
                  >
                    + Adicionar topic
                  </Button>
                </div>
              </div>

              <aside className="flex flex-col gap-2">
                <h3 className="text-[13px] font-semibold text-text-secondary">
                  Topics adicionados ({topics.length}/{MAX_TOPICS})
                </h3>
                {topics.length === 0 ? (
                  <p className="text-[13px] text-text-muted bg-surface border border-border rounded-[10px] px-3 py-4 text-center">
                    Nenhum topic ainda.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {topics.map((tp, i) => (
                      <li
                        key={`${tp.name}-${i}`}
                        className="flex items-center gap-2 bg-surface border border-border rounded-[10px] px-3 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-medium truncate">{tp.name}</div>
                          <div className="text-[12px] text-text-muted truncate">
                            {tp.type} · {tp.aliases.length} alias{tp.aliases.length === 1 ? "" : "es"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTopic(i)}
                          className="text-text-muted hover:text-danger transition-colors"
                          aria-label={`Remover ${tp.name}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            </div>

            <div className="sticky bottom-4 flex items-center justify-between gap-3 bg-bg/80 backdrop-blur-sm rounded-[12px] border border-border px-4 py-3">
              <span className="text-[13px] text-text-muted">
                {topics.length} topic{topics.length === 1 ? "" : "s"} · {selectedHandles.size} fonte
                {selectedHandles.size === 1 ? "" : "s"}
              </span>
              <Button onClick={finalize} loading={finalizing} disabled={topics.length < 1}>
                {finalizing ? "Configurando..." : "Finalizar"}
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
