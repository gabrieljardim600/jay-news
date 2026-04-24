"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { WizardStepper } from "@/components/wizard/WizardStepper";
import { StepInterests } from "@/components/wizard/StepInterests";
import { StepSources, type WizardSource } from "@/components/wizard/StepSources";
import { StepPreferences } from "@/components/wizard/StepPreferences";
import { StepReview } from "@/components/wizard/StepReview";
import { ArrowLeft, Check, Loader2 } from "lucide-react";

export default function WizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📰");
  const [color, setColor] = useState("#007AFF");
  const [interests, setInterests] = useState<string[]>([]);
  const [sources, setSources] = useState<WizardSource[]>([]);
  const [language, setLanguage] = useState("pt-BR");
  const [summaryStyle, setSummaryStyle] = useState("executive");
  const [digestTime, setDigestTime] = useState("10:00");
  const [maxArticles, setMaxArticles] = useState(20);
  const [exclusions, setExclusions] = useState<string[]>([]);

  const canProceed = [
    name.trim().length > 0 && interests.length > 0,
    true,
    true,
    true,
  ];

  async function saveConfig(): Promise<string> {
    const configRes = await fetch("/api/digest-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), icon, color, language, summary_style: summaryStyle, digest_time: digestTime, max_articles: maxArticles }),
    });
    if (!configRes.ok) {
      const err = await configRes.json().catch(() => ({}));
      throw new Error(err.error || `Erro ao criar digest (${configRes.status})`);
    }
    const config = await configRes.json();
    const configId: string = config.id;
    if (!configId) throw new Error("Digest criado sem ID");

    const topicMap: Record<string, string> = {};
    const topicErrors: string[] = [];
    await Promise.all(interests.map(async (interest) => {
      const topicRes = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: interest, keywords: [interest], priority: "medium", digest_config_id: configId }),
      });
      if (!topicRes.ok) {
        topicErrors.push(interest);
        return;
      }
      const topic = await topicRes.json();
      topicMap[interest] = topic.id;
    }));

    const sourceErrors: string[] = [];
    await Promise.all(sources.map(async (source) => {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: source.name, url: source.url, source_type: source.source_type || "rss",
          weight: source.weight, topic_id: source.interest ? topicMap[source.interest] || null : null,
          digest_config_id: configId,
        }),
      });
      if (!res.ok) sourceErrors.push(source.name);
    }));

    await Promise.all(exclusions.map((keyword) =>
      fetch("/api/exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, digest_config_id: configId }),
      })
    ));

    if (topicErrors.length > 0 || sourceErrors.length > 0) {
      console.warn("Partial save errors:", { topicErrors, sourceErrors });
    }

    return configId;
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await saveConfig();
      setDone(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido ao salvar";
      console.error("Failed to save:", e);
      setSaveError(msg);
      setSaving(false);
    }
  }

  const isLastStep = step === 3;

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-10">
      {/* Header */}
      <header className="flex items-center gap-3 mb-10">
        <button
          onClick={() => step > 0 && !done ? setStep(step - 1) : router.push("/")}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-secondary"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </button>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Novo Digest</h1>
          {!done && <p className="text-text-muted text-[13px]">Passo {step + 1} de 4</p>}
        </div>
      </header>

      {!done && <WizardStepper currentStep={step} onStepClick={setStep} />}

      <div className="mb-10">
        {!done && step === 0 && (
          <StepInterests
            name={name} icon={icon} color={color} interests={interests}
            onNameChange={setName} onIconChange={setIcon} onColorChange={setColor} onInterestsChange={setInterests}
          />
        )}
        {!done && step === 1 && (
          <StepSources interests={interests} sources={sources} onSourcesChange={setSources} />
        )}
        {!done && step === 2 && (
          <StepPreferences
            language={language} summaryStyle={summaryStyle} digestTime={digestTime} maxArticles={maxArticles} exclusions={exclusions}
            onLanguageChange={setLanguage} onSummaryStyleChange={setSummaryStyle} onDigestTimeChange={setDigestTime}
            onMaxArticlesChange={setMaxArticles} onExclusionsChange={setExclusions}
          />
        )}
        {!done && isLastStep && (
          <StepReview
            name={name} icon={icon} color={color} interests={interests} sources={sources}
            language={language} summaryStyle={summaryStyle} digestTime={digestTime} maxArticles={maxArticles} exclusions={exclusions}
          />
        )}

        {/* Save error */}
        {saveError && (
          <div className="max-w-md mx-auto mb-4 p-3 rounded-[10px] bg-danger/10 border border-danger/20">
            <p className="text-[13px] text-danger font-medium">{saveError}</p>
          </div>
        )}

        {/* Saving state */}
        {saving && !done && (
          <div className="max-w-md mx-auto text-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
            <p className="text-[15px] text-text-secondary">Salvando seu digest...</p>
          </div>
        )}

        {/* Done state */}
        {done && (
          <div className="max-w-md mx-auto text-center py-12">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-success/15 flex items-center justify-center">
              <Check className="w-7 h-7 text-success" />
            </div>
            <h2 className="text-[22px] font-bold tracking-tight mb-2">Digest criado</h2>
            <p className="text-[14px] text-text-muted mb-8 leading-relaxed">
              Seu digest &quot;{icon} {name}&quot; foi salvo. Gere o primeiro na pagina principal.
            </p>
            <Button size="lg" onClick={() => router.push("/")} className="rounded-full px-8">
              Ir para o feed
            </Button>
          </div>
        )}
      </div>

      {!done && !saving && (
        <div className="flex justify-end max-w-xl mx-auto gap-3">
          {step < 3 && (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed[step]}
              className="rounded-full px-6"
            >
              Proximo
            </Button>
          )}
          {isLastStep && (
            <Button onClick={handleSave} loading={saving} className="rounded-full px-6">
              Criar digest
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
