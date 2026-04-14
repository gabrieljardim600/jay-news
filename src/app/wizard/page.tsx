"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { WizardStepper } from "@/components/wizard/WizardStepper";
import { StepInterests } from "@/components/wizard/StepInterests";
import { StepSources, type WizardSource } from "@/components/wizard/StepSources";
import { StepPreferences } from "@/components/wizard/StepPreferences";
import { StepReview } from "@/components/wizard/StepReview";

export default function WizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState(0);

  // Step 1 state
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📰");
  const [color, setColor] = useState("#fb830e");
  const [interests, setInterests] = useState<string[]>([]);

  // Step 2 state
  const [sources, setSources] = useState<WizardSource[]>([]);

  // Step 3 state
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
    // 1. Create digest config
    const configRes = await fetch("/api/digest-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        icon,
        color,
        language,
        summary_style: summaryStyle,
        digest_time: digestTime,
        max_articles: maxArticles,
      }),
    });
    const config = await configRes.json();
    const configId: string = config.id;

    // 2. Create topics from interests
    const topicMap: Record<string, string> = {};
    await Promise.all(
      interests.map(async (interest) => {
        const topicRes = await fetch("/api/topics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: interest,
            keywords: [interest],
            priority: "medium",
            digest_config_id: configId,
          }),
        });
        const topic = await topicRes.json();
        topicMap[interest] = topic.id;
      })
    );

    // 3. Create sources
    await Promise.all(
      sources.map((source) =>
        fetch("/api/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: source.name,
            url: source.url,
            source_type: source.source_type || "rss",
            weight: source.weight,
            topic_id: source.interest ? topicMap[source.interest] || null : null,
            digest_config_id: configId,
          }),
        })
      )
    );

    // 4. Create exclusions
    await Promise.all(
      exclusions.map((keyword) =>
        fetch("/api/exclusions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword, digest_config_id: configId }),
        })
      )
    );

    return configId;
  }

  async function handleSaveOnly() {
    setSaving(true);
    try {
      await saveConfig();
      router.push("/");
    } finally {
      setSaving(false);
    }
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
    } finally {
      setGenerating(false);
    }
  }

  const isLastStep = step === 3;
  const isDone = isLastStep && generatedSummary !== null;

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold font-heading">Novo Digest</h1>
        <p className="text-text-secondary text-sm mt-1">Configure seu digest personalizado</p>
      </header>

      {!isDone && <WizardStepper currentStep={step} onStepClick={setStep} />}

      <div className="mb-8">
        {step === 0 && (
          <StepInterests
            name={name}
            icon={icon}
            color={color}
            interests={interests}
            onNameChange={setName}
            onIconChange={setIcon}
            onColorChange={setColor}
            onInterestsChange={setInterests}
          />
        )}
        {step === 1 && (
          <StepSources
            interests={interests}
            sources={sources}
            onSourcesChange={setSources}
          />
        )}
        {step === 2 && (
          <StepPreferences
            language={language}
            summaryStyle={summaryStyle}
            digestTime={digestTime}
            maxArticles={maxArticles}
            exclusions={exclusions}
            onLanguageChange={setLanguage}
            onSummaryStyleChange={setSummaryStyle}
            onDigestTimeChange={setDigestTime}
            onMaxArticlesChange={setMaxArticles}
            onExclusionsChange={setExclusions}
          />
        )}
        {isLastStep && !isDone && (
          <StepReview
            name={name}
            icon={icon}
            color={color}
            interests={interests}
            sources={sources}
            language={language}
            summaryStyle={summaryStyle}
            digestTime={digestTime}
            maxArticles={maxArticles}
            exclusions={exclusions}
          />
        )}
        {isDone && (
          <div className="max-w-xl mx-auto text-center py-8">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold mb-2">Digest criado com sucesso!</h2>
            {generatedCount > 0 && (
              <p className="text-text-secondary mb-3">{generatedCount} artigos encontrados</p>
            )}
            {generatedSummary && (
              <p className="text-sm text-text-muted mb-8 max-w-md mx-auto">{generatedSummary}</p>
            )}
            <Button size="lg" onClick={() => router.push("/")}>
              Ver meu digest
            </Button>
          </div>
        )}
      </div>

      {!isDone && (
        <div className="flex justify-between max-w-xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => (step > 0 ? setStep(step - 1) : router.push("/"))}
          >
            {step === 0 ? "Cancelar" : "Voltar"}
          </Button>
          <div className="flex gap-2">
            {step < 3 && (
              <Button onClick={() => setStep(step + 1)} disabled={!canProceed[step]}>
                Proximo
              </Button>
            )}
            {isLastStep && (
              <>
                <Button variant="outline" onClick={handleSaveOnly} loading={saving} disabled={generating}>
                  Salvar sem gerar
                </Button>
                <Button onClick={handleSaveAndGenerate} loading={generating} disabled={saving}>
                  {generating ? "Gerando..." : "Gerar primeiro digest"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
