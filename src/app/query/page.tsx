"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Check, ChevronRight, ChevronLeft, Loader2, Search, AlertCircle, RefreshCw } from "lucide-react";

type EntityField = "name" | "website" | "cnpj" | "ticker" | "aliases";

type ModuleMeta = {
  id: string;
  label: string;
  description: string;
  icon: string | null;
  always_on: boolean;
  required_fields: EntityField[];
  optional_fields: EntityField[];
  provider_count: number;
};

type ResearchBlock = {
  providerId: string;
  label: string;
  text: string;
  hints?: Record<string, unknown>;
};

type ModuleRunResult = {
  moduleId: string;
  moduleLabel: string;
  blocks: ResearchBlock[];
};

type QueryResponse = {
  entity: { name: string; website: string | null; cnpj: string | null; ticker: string | null };
  modules: ModuleRunResult[];
  hints: Record<string, unknown>;
  durationMs: number;
};

const FIELD_LABEL: Record<EntityField, string> = {
  name: "Nome",
  website: "Site",
  cnpj: "CNPJ",
  ticker: "Ticker",
  aliases: "Apelidos",
};

type Step = 1 | 2 | 3;

export default function QueryPage() {
  const [step, setStep] = useState<Step>(1);
  const [modules, setModules] = useState<ModuleMeta[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [ticker, setTicker] = useState("");
  const [aliases, setAliases] = useState("");

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/query/modules");
      if (cancelled) return;
      if (res.ok) {
        const data: ModuleMeta[] = await res.json();
        setModules(data);
        // pre-select always_on
        setSelected(new Set(data.filter((m) => m.always_on).map((m) => m.id)));
      }
      setLoadingModules(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const requiredFields = useMemo<Set<EntityField>>(() => {
    const set = new Set<EntityField>(["name"]);
    for (const m of modules) {
      if (!selected.has(m.id) && !m.always_on) continue;
      m.required_fields.forEach((f) => set.add(f));
    }
    return set;
  }, [modules, selected]);

  const optionalFields = useMemo<Set<EntityField>>(() => {
    const set = new Set<EntityField>();
    for (const m of modules) {
      if (!selected.has(m.id) && !m.always_on) continue;
      m.optional_fields.forEach((f) => { if (!requiredFields.has(f)) set.add(f); });
    }
    return set;
  }, [modules, selected, requiredFields]);

  const canProceedStep2 = useMemo(() => {
    if (!name.trim()) return false;
    if (requiredFields.has("website") && !website.trim()) return false;
    if (requiredFields.has("cnpj") && cnpj.replace(/\D/g, "").length !== 14) return false;
    if (requiredFields.has("ticker") && !ticker.trim()) return false;
    return true;
  }, [name, website, cnpj, ticker, requiredFields]);

  function toggleModule(id: string) {
    const m = modules.find((x) => x.id === id);
    if (m?.always_on) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function runQuery(forceRefresh = false) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleIds: Array.from(selected),
          entity: {
            name: name.trim(),
            website: website.trim() || null,
            cnpj: cnpj.trim() || null,
            ticker: ticker.trim() || null,
            aliases: aliases.split(",").map((s) => s.trim()).filter(Boolean),
          },
          forceRefresh,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data: QueryResponse = await res.json();
      setResult(data);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao executar consulta");
    } finally {
      setRunning(false);
    }
  }

  function resetAll() {
    setStep(1);
    setResult(null);
    setError(null);
  }

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8 pb-20">
      <AppHeader />

      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Consulta sob demanda
        </p>
        <p className="text-[13px] text-text-secondary mt-0.5">
          Escolha as fontes, informe os dados do alvo e receba um relatório consolidado.
        </p>
      </div>

      <Stepper step={step} />

      {step === 1 && (
        <StepModules
          modules={modules}
          loading={loadingModules}
          selected={selected}
          onToggle={toggleModule}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <StepParams
          requiredFields={requiredFields}
          optionalFields={optionalFields}
          name={name} setName={setName}
          website={website} setWebsite={setWebsite}
          cnpj={cnpj} setCnpj={setCnpj}
          ticker={ticker} setTicker={setTicker}
          aliases={aliases} setAliases={setAliases}
          canProceed={canProceedStep2}
          running={running}
          error={error}
          onBack={() => setStep(1)}
          onRun={() => runQuery(false)}
        />
      )}

      {step === 3 && result && (
        <StepResults
          result={result}
          onBack={() => setStep(2)}
          onReset={resetAll}
          onRefresh={() => runQuery(true)}
          refreshing={running}
        />
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = [
    { n: 1, label: "Fontes" },
    { n: 2, label: "Parâmetros" },
    { n: 3, label: "Relatório" },
  ];
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => {
        const active = step === s.n;
        const done = step > s.n;
        return (
          <div key={s.n} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-medium transition-all ${
                active ? "bg-text text-background"
                : done ? "bg-surface text-text"
                : "bg-surface text-text-muted"
              }`}
            >
              {done ? <Check className="w-3 h-3" /> : <span className="w-4 text-center">{s.n}</span>}
              <span>{s.label}</span>
            </div>
            {i < steps.length - 1 && <span className="text-text-muted text-[11px]">—</span>}
          </div>
        );
      })}
    </div>
  );
}

function StepModules({
  modules, loading, selected, onToggle, onNext,
}: {
  modules: ModuleMeta[];
  loading: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
}) {
  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
        {modules.map((m) => {
          const isSelected = selected.has(m.id);
          const locked = m.always_on;
          return (
            <button
              key={m.id}
              onClick={() => onToggle(m.id)}
              disabled={locked}
              className={`text-left p-3.5 rounded-[14px] border transition-all ${
                isSelected
                  ? "border-primary/60 bg-primary/5"
                  : "border-border bg-surface hover:border-text-muted/40"
              } ${locked ? "cursor-default" : "active:scale-[0.99]"}`}
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-[14px] font-semibold leading-tight">{m.label}</p>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-primary border-primary text-white" : "border-border"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                </div>
              </div>
              <p className="text-[12px] text-text-muted leading-snug mb-2">{m.description}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-text-muted">{m.provider_count} fontes</span>
                {locked && (
                  <span className="text-[10px] px-1.5 h-4 inline-flex items-center rounded-full bg-background text-text-secondary">sempre ativo</span>
                )}
                {m.required_fields.length > 0 && (
                  <span className="text-[10px] px-1.5 h-4 inline-flex items-center rounded-full bg-background text-text-secondary">
                    precisa: {m.required_fields.map((f) => FIELD_LABEL[f]).join(", ")}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-text-muted">
          {selected.size} fonte{selected.size === 1 ? "" : "s"} selecionada{selected.size === 1 ? "" : "s"}
        </p>
        <Button onClick={onNext} className="rounded-full">
          Continuar <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function StepParams({
  requiredFields, optionalFields,
  name, setName, website, setWebsite, cnpj, setCnpj, ticker, setTicker, aliases, setAliases,
  canProceed, running, error, onBack, onRun,
}: {
  requiredFields: Set<EntityField>;
  optionalFields: Set<EntityField>;
  name: string; setName: (v: string) => void;
  website: string; setWebsite: (v: string) => void;
  cnpj: string; setCnpj: (v: string) => void;
  ticker: string; setTicker: (v: string) => void;
  aliases: string; setAliases: (v: string) => void;
  canProceed: boolean;
  running: boolean;
  error: string | null;
  onBack: () => void;
  onRun: () => void;
}) {
  const showField = (f: EntityField) => requiredFields.has(f) || optionalFields.has(f);
  return (
    <div>
      <div className="p-4 rounded-[14px] border border-border bg-surface mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-3">Obrigatórios</p>
        <Field label="Nome da empresa ou pessoa" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Acme S.A."
            className="w-full px-3 py-2.5 rounded-[10px] bg-background border border-border text-[14px] text-text outline-none focus:border-primary transition-colors"
          />
        </Field>
        {requiredFields.has("website") && (
          <Field label="Site oficial" required>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://acme.com"
              className="w-full px-3 py-2.5 rounded-[10px] bg-background border border-border text-[14px] text-text outline-none focus:border-primary transition-colors"
            />
          </Field>
        )}
        {requiredFields.has("cnpj") && (
          <Field label="CNPJ" required hint="14 dígitos">
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0001-00"
              className="w-full px-3 py-2.5 rounded-[10px] bg-background border border-border text-[14px] text-text outline-none focus:border-primary transition-colors"
            />
          </Field>
        )}
        {requiredFields.has("ticker") && (
          <Field label="Ticker (B3/bolsa)" required>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="PETR4"
              className="w-full px-3 py-2.5 rounded-[10px] bg-background border border-border text-[14px] text-text outline-none focus:border-primary transition-colors"
            />
          </Field>
        )}
      </div>

      {(optionalFields.size > 0 || showField("aliases")) && (
        <div className="p-4 rounded-[14px] border border-border bg-surface mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-3">Opcionais</p>
          {optionalFields.has("website") && (
            <Field label="Site oficial">
              <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" className="w-full px-3 py-2.5 rounded-[10px] bg-background border border-border text-[14px] text-text outline-none focus:border-primary transition-colors" />
            </Field>
          )}
          {optionalFields.has("cnpj") && (
            <Field label="CNPJ">
              <input type="text" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" className="w-full px-3 py-2.5 rounded-[10px] bg-background border border-border text-[14px] text-text outline-none focus:border-primary transition-colors" />
            </Field>
          )}
          {optionalFields.has("ticker") && (
            <Field label="Ticker">
              <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="PETR4" className="w-full px-3 py-2.5 rounded-[10px] bg-background border border-border text-[14px] text-text outline-none focus:border-primary transition-colors" />
            </Field>
          )}
          <Field label="Apelidos / variações" hint="Separados por vírgula">
            <input type="text" value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="Acme Corp, Acme Brasil" className="w-full px-3 py-2.5 rounded-[10px] bg-background border border-border text-[14px] text-text outline-none focus:border-primary transition-colors" />
          </Field>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-[10px] border border-red-500/30 bg-red-500/5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-[13px] text-red-500">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="rounded-full" disabled={running}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <Button onClick={onRun} disabled={!canProceed} loading={running} className="rounded-full">
          <Search className="w-4 h-4 mr-1.5" /> Executar consulta
        </Button>
      </div>

    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium text-text-secondary">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        {hint && <span className="text-[10px] text-text-muted">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function StepResults({
  result, onBack, onReset, onRefresh, refreshing,
}: {
  result: QueryResponse;
  onBack: () => void;
  onReset: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const totalBlocks = result.modules.reduce((s, m) => s + m.blocks.length, 0);
  return (
    <div>
      <div className="p-4 rounded-[14px] border border-border bg-surface mb-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Alvo</p>
            <p className="text-[18px] font-semibold truncate">{result.entity.name}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} loading={refreshing} className="rounded-full shrink-0">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {result.entity.website && <Chip>site: {result.entity.website}</Chip>}
          {result.entity.cnpj && <Chip>CNPJ: {result.entity.cnpj}</Chip>}
          {result.entity.ticker && <Chip>ticker: {result.entity.ticker}</Chip>}
          <Chip>{result.modules.length} módulos · {totalBlocks} blocos · {(result.durationMs / 1000).toFixed(1)}s</Chip>
        </div>
      </div>

      {result.modules.length === 0 && (
        <div className="text-center py-12 text-text-muted text-[13px]">
          Nenhuma fonte retornou dados.
        </div>
      )}

      <div className="flex flex-col gap-3 mb-6">
        {result.modules.map((m) => (
          <details key={m.moduleId} open className="rounded-[14px] border border-border bg-surface">
            <summary className="px-4 py-3 cursor-pointer flex items-center justify-between">
              <span className="text-[14px] font-semibold">{m.moduleLabel}</span>
              <span className="text-[11px] text-text-muted">{m.blocks.length} bloco{m.blocks.length === 1 ? "" : "s"}</span>
            </summary>
            <div className="border-t border-border">
              {m.blocks.map((b, i) => (
                <div key={`${m.moduleId}-${b.providerId}-${i}`} className="px-4 py-3 border-b border-border last:border-b-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[12px] font-semibold">{b.label}</span>
                    <span className="text-[10px] text-text-muted">{b.providerId}</span>
                  </div>
                  <pre className="text-[12px] text-text-secondary whitespace-pre-wrap break-words font-sans leading-relaxed">
                    {b.text}
                  </pre>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="rounded-full">
          <ChevronLeft className="w-4 h-4 mr-1" /> Ajustar parâmetros
        </Button>
        <Button variant="outline" onClick={onReset} className="rounded-full">
          Nova consulta
        </Button>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 h-5 rounded-full bg-background text-text-secondary">{children}</span>
  );
}
