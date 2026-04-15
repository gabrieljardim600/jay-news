"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MarketsWizardStepper } from "@/components/markets/MarketsWizardStepper";
import { MarketStepBasics } from "@/components/markets/MarketStepBasics";
import { MarketStepSubtopics } from "@/components/markets/MarketStepSubtopics";
import { MarketStepCompetitors, type CompetitorDraft } from "@/components/markets/MarketStepCompetitors";
import { MarketStepSources, type SourceDraft } from "@/components/markets/MarketStepSources";

export default function MarketsWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📊");
  const [color, setColor] = useState("#007AFF");
  const [language] = useState("pt-BR");

  const [subtopics, setSubtopics] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorDraft[]>([]);
  const [sources, setSources] = useState<SourceDraft[]>([]);

  const canProceed = [name.trim().length > 0, true, true, true];

  async function saveMarket() {
    const marketRes = await fetch("/api/markets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim(), icon, color, language }),
    });
    if (!marketRes.ok) {
      const err = await marketRes.json().catch(() => ({}));
      throw new Error(err.error || `Erro ao criar market (${marketRes.status})`);
    }
    const market = await marketRes.json();
    const marketId: string = market.id;

    const warnings: string[] = [];
    async function postSub(path: string, body: unknown, label: string) {
      const r = await fetch(`/api/markets/${marketId}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        warnings.push(`${label}: ${err.error || r.statusText}`);
      }
    }

    if (subtopics.length > 0) await postSub("/subtopics", { labels: subtopics }, "sub-tópicos");
    if (competitors.length > 0) await postSub("/competitors", { competitors }, "concorrentes");
    if (sources.length > 0) await postSub("/sources", { sources }, "fontes");

    if (warnings.length > 0) {
      throw new Error(`Market criado, mas falhou ao salvar: ${warnings.join("; ")}`);
    }

    return marketId;
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await saveMarket();
      setDone(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      console.error(e);
      setSaveError(msg);
      setSaving(false);
    }
  }

  const isLastStep = step === 3;

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-10">
      <header className="flex items-center gap-3 mb-10">
        <button
          onClick={() => (step > 0 && !done ? setStep(step - 1) : router.push("/markets"))}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-secondary"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </button>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Novo Market</h1>
          {!done && <p className="text-text-muted text-[13px]">Passo {step + 1} de 4</p>}
        </div>
      </header>

      {!done && <MarketsWizardStepper currentStep={step} onStepClick={setStep} />}

      <div className="mb-10">
        {!done && step === 0 && (
          <MarketStepBasics
            name={name}
            description={description}
            icon={icon}
            color={color}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onIconChange={setIcon}
            onColorChange={setColor}
          />
        )}
        {!done && step === 1 && (
          <MarketStepSubtopics subtopics={subtopics} onChange={setSubtopics} />
        )}
        {!done && step === 2 && (
          <MarketStepCompetitors
            marketName={name}
            subtopics={subtopics}
            language={language}
            competitors={competitors}
            onChange={setCompetitors}
          />
        )}
        {!done && isLastStep && (
          <MarketStepSources
            marketName={name}
            subtopics={subtopics}
            language={language}
            sources={sources}
            onChange={setSources}
          />
        )}

        {saveError && (
          <div className="max-w-md mx-auto mt-6 mb-4 p-3 rounded-[10px] bg-danger/10 border border-danger/20">
            <p className="text-[13px] text-danger font-medium">{saveError}</p>
          </div>
        )}

        {saving && !done && (
          <div className="max-w-md mx-auto text-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
            <p className="text-[15px] text-text-secondary">Salvando market...</p>
          </div>
        )}

        {done && (
          <div className="max-w-md mx-auto text-center py-12">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-success/15 flex items-center justify-center">
              <Check className="w-7 h-7 text-success" />
            </div>
            <h2 className="text-[22px] font-bold tracking-tight mb-2">Market criado</h2>
            <p className="text-[14px] text-text-muted mb-8 leading-relaxed">
              &quot;{icon} {name}&quot; está pronto. A coleta de notícias e concorrentes entra no próximo release.
            </p>
            <Button size="lg" onClick={() => router.push("/markets")} className="rounded-full px-8">
              Ir para markets
            </Button>
          </div>
        )}
      </div>

      {!done && !saving && (
        <div className="flex justify-end max-w-xl mx-auto gap-3">
          {step < 3 && (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed[step]} className="rounded-full px-6">
              Próximo
            </Button>
          )}
          {isLastStep && (
            <Button onClick={handleSave} loading={saving} className="rounded-full px-6">
              Criar market
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
