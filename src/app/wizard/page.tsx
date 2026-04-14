"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { WizardStepper } from "@/components/wizard/WizardStepper";
import { StepInterests } from "@/components/wizard/StepInterests";
import { StepSources, type WizardSource } from "@/components/wizard/StepSources";
import { StepPreferences } from "@/components/wizard/StepPreferences";
import { StepReview } from "@/components/wizard/StepReview";
import { ArrowLeft, Check } from "lucide-react";

export default function WizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState(0);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📰");
  const [color, setColor] = useState("#007AFF");
  const [interests, setInterests] = useState<string[]>([]);
  const [sources, setSources] = useState<WizardSource[]>([]);
  const [language, setLanguage] = useState("pt-BR");
  const [summaryStyle, setSummaryStyle] = useState("executive");
  const [digestTime, setDigestTime] = useState("07:00");
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
    const config = await configRes.json();
    const configId: string = config.id;

    const topicMap: Record<string, string> = {};
    await Promise.all(interests.map(async (interest) => {
      const topicRes = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: interest, keywords: [interest], priority: "medium", digest_config_id: configId }),
      });
      const topic = await topicRes.json();
      topicMap[interest] = topic.id;
    }));

    await Promise.all(sources.map((source) =>
      fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: source.name, url: source.url, source_type: source.source_type || "rss",
          weight: source.weight, topic_id: source.interest ? topicMap[source.interest] || null : null,
          digest_config_id: configId,
        }),
      })
    ));

    await Promise.all(exclusions.map((keyword) =>
      fetch("/api/exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, digest_config_id: configId }),
      })
    ));

    return configId;
  }

  async function handleSaveOnly() {
    setSaving(true);
    try { await saveConfig(); router.push("/"); }
    finally { setSaving(false); }
  }

  async function handleSaveAndGenerate() {
    setGenerating(true);
    try {
      const configId = await saveConfig();
      const genRes = await fetch("/api/digest/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestConfigId: configId }),
      });
      const { digestId } = await genRes.json();
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((r) => setTimeout(r, 2000));
        const check = await fetch(`/api/digest/${digestId}`);
        const data = await check.json();
        if (data.status === "completed" || data.status === "failed") {
          setGeneratedSummary(data.summary || null);
          setGeneratedCount(data.articles?.length || data.metadata?.total_articles || 0);
          break;
        }
        attempts++;
      }
    } finally { setGenerating(false); }
  }

  const isLastStep = step === 3;
  const isDone = isLastStep && generatedSummary !== null;

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-10">
      {/* Header */}
      <header className="flex items-center gap-3 mb-10">
        <button
          onClick={() => step > 0 ? setStep(step - 1) : router.push("/")}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-secondary"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </button>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Novo Digest</h1>
          <p className="text-text-muted text-[13px]">Passo {step + 1} de 4</p>
        </div>
      </header>

      {!isDone && <WizardStepper currentStep={step} onStepClick={setStep} />}

      <div className="mb-10">
        {step === 0 && (
          <StepInterests
            name={name} icon={icon} color={color} interests={interests}
            onNameChange={setName} onIconChange={setIcon} onColorChange={setColor} onInterestsChange={setInterests}
          />
        )}
        {step === 1 && (
          <StepSources interests={interests} sources={sources} onSourcesChange={setSources} />
        )}
        {step === 2 && (
          <StepPreferences
            language={language} summaryStyle={summaryStyle} digestTime={digestTime} maxArticles={maxArticles} exclusions={exclusions}
            onLanguageChange={setLanguage} onSummaryStyleChange={setSummaryStyle} onDigestTimeChange={setDigestTime}
            onMaxArticlesChange={setMaxArticles} onExclusionsChange={setExclusions}
          />
        )}
        {isLastStep && !isDone && (
          <StepReview
            name={name} icon={icon} color={color} interests={interests} sources={sources}
            language={language} summaryStyle={summaryStyle} digestTime={digestTime} maxArticles={maxArticles} exclusions={exclusions}
          />
        )}
        {isDone && (
          <div className="max-w-md mx-auto text-center py-12">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-success/15 flex items-center justify-center">
              <Check className="w-7 h-7 text-success" />
            </div>
            <h2 className="text-[22px] font-bold tracking-tight mb-2">Digest criado</h2>
            {generatedCount > 0 && (
              <p className="text-text-secondary text-[15px] mb-2">{generatedCount} artigos encontrados</p>
            )}
            {generatedSummary && (
              <p className="text-[14px] text-text-muted mb-8 leading-relaxed">{generatedSummary}</p>
            )}
            <Button size="lg" onClick={() => router.push("/")} className="rounded-full px-8">
              Ver meu digest
            </Button>
          </div>
        )}
      </div>

      {!isDone && (
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
            <>
              <Button variant="outline" onClick={handleSaveOnly} loading={saving} disabled={generating} className="rounded-full">
                Salvar
              </Button>
              <Button onClick={handleSaveAndGenerate} loading={generating} disabled={saving} className="rounded-full">
                {generating ? "Gerando..." : "Criar e gerar"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
