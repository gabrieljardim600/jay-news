"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { Check, ChevronRight, ChevronLeft, Loader2, Search, AlertCircle, RefreshCw, ExternalLink, Sparkles, SlidersHorizontal, Settings2, Copy, CheckCheck, FileDown, ListTree, History, Trash2 } from "lucide-react";

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

type ParsedItem = {
  title: string;
  url?: string;
  snippet?: string;
  source?: string;
  date?: string;
};

type ResearchBlock = {
  providerId: string;
  label: string;
  text: string;
  items?: ParsedItem[];
  meta?: Record<string, string>;
  hints?: Record<string, unknown>;
};

type ModuleRunResult = {
  moduleId: string;
  moduleLabel: string;
  blocks: ResearchBlock[];
};

type QueryResponse = {
  entity: { name: string; website: string | null; cnpj: string | null; ticker: string | null };
  discovery?: { discovered: Array<"website" | "cnpj"> };
  relevance?: { requireTerms: string[]; excludeTerms: string[]; domainAllow: string[]; strict: boolean };
  modules: ModuleRunResult[];
  hints: Record<string, unknown>;
  durationMs: number;
};

type OutputSection = { id: string; title: string; kind: "paragraph" | "list" | "keyvalue"; hint?: string };

type BriefingProfile = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  icon: string | null;
  module_ids: string[];
  output_sections: OutputSection[];
  is_builtin: boolean;
};

type BriefingResponse = {
  profile: { id: string; slug: string; label: string };
  entity: { name: string; website?: string | null; cnpj?: string | null };
  discovery?: { discovered: Array<"website" | "cnpj"> };
  sections: OutputSection[];
  content: Record<string, unknown>;
  modules: ModuleRunResult[];
  hints: Record<string, unknown>;
  modelUsed: string;
  durationMs: number;
};

type Mode = "profile" | "custom";

type QueryRunListItem = {
  id: string;
  kind: "raw" | "briefing";
  entity_name: string;
  entity: { name?: string; website?: string | null; cnpj?: string | null };
  profile_slug: string | null;
  profile_label: string | null;
  module_ids: string[];
  duration_ms: number | null;
  created_at: string;
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
  const [mode, setMode] = useState<Mode>("profile");
  const [modules, setModules] = useState<ModuleMeta[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<BriefingProfile[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [ticker, setTicker] = useState("");
  const [aliases, setAliases] = useState("");
  const [excludeTerms, setExcludeTerms] = useState("");
  const [strictMatch, setStrictMatch] = useState(true);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<QueryRunListItem[]>([]);

  async function reloadHistory() {
    const r = await fetch("/api/query/runs?limit=30");
    if (r.ok) setHistory(await r.json());
  }

  async function openRun(id: string) {
    setError(null);
    const r = await fetch(`/api/query/runs/${id}`);
    if (!r.ok) { setError("Não foi possível carregar o histórico"); return; }
    const row = await r.json();
    if (row.kind === "briefing") {
      setBriefing(row.result);
      setResult(null);
    } else {
      setResult(row.result);
      setBriefing(null);
    }
    setStep(3);
  }

  async function deleteRun(id: string) {
    if (!confirm("Remover essa consulta do histórico?")) return;
    await fetch(`/api/query/runs/${id}`, { method: "DELETE" });
    void reloadHistory();
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [mRes, pRes, hRes] = await Promise.all([
        fetch("/api/query/modules"),
        fetch("/api/briefing-profiles"),
        fetch("/api/query/runs?limit=30"),
      ]);
      if (cancelled) return;
      if (mRes.ok) {
        const data: ModuleMeta[] = await mRes.json();
        setModules(data);
        setSelected(new Set(data.filter((m) => m.always_on).map((m) => m.id)));
      }
      if (pRes.ok) {
        const data: BriefingProfile[] = await pRes.json();
        setProfiles(data);
      }
      if (hRes.ok) setHistory(await hRes.json());
      setLoadingModules(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Refresh history after a successful run.
  useEffect(() => {
    if (!running) void reloadHistory();
  }, [running]);

  // When a profile is selected in profile mode, sync its module_ids to `selected`.
  useEffect(() => {
    if (mode !== "profile" || !profileId) return;
    const p = profiles.find((x) => x.id === profileId);
    if (!p) return;
    const alwaysOn = modules.filter((m) => m.always_on).map((m) => m.id);
    setSelected(new Set([...alwaysOn, ...p.module_ids]));
  }, [mode, profileId, profiles, modules]);

  // Só o nome é obrigatório. Qualquer outro campo reforça a pesquisa, mas a
  // plataforma tenta descobrir site e CNPJ sozinha via auto-discovery.
  const hintedFields = useMemo<Set<EntityField>>(() => {
    const set = new Set<EntityField>();
    for (const m of modules) {
      if (!selected.has(m.id) && !m.always_on) continue;
      m.required_fields.forEach((f) => { if (f !== "name") set.add(f); });
      m.optional_fields.forEach((f) => set.add(f));
    }
    return set;
  }, [modules, selected]);

  const canProceedStep2 = useMemo(() => name.trim().length >= 2, [name]);

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
      const entity = {
        name: name.trim(),
        website: website.trim() || null,
        cnpj: cnpj.trim() || null,
        ticker: ticker.trim() || null,
        aliases: aliases.split(",").map((s) => s.trim()).filter(Boolean),
      };
      const excl = excludeTerms.split(",").map((s) => s.trim()).filter(Boolean);

      if (mode === "profile" && profileId) {
        // Jump to step 3 first so the loading shell is visible while Claude runs.
        setBriefing(null);
        setStep(3);
        const res = await fetch("/api/query/briefing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId, entity, excludeTerms: excl, strictMatch, forceRefresh }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `HTTP ${res.status}`);
        }
        const data: BriefingResponse = await res.json();
        setBriefing(data);
        setResult(null);
        return; // already on step 3
      } else {
        const res = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moduleIds: Array.from(selected),
            entity,
            excludeTerms: excl,
            strictMatch,
            forceRefresh,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `HTTP ${res.status}`);
        }
        const data: QueryResponse = await res.json();
        setResult(data);
        setBriefing(null);
      }
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao executar consulta");
      if (mode === "profile") setStep(2); // back from the loading shell
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
        <>
          {history.length > 0 && (
            <HistoryPanel items={history} onOpen={openRun} onDelete={deleteRun} />
          )}
          <StepOne
            mode={mode}
            setMode={setMode}
            profiles={profiles}
            profileId={profileId}
            setProfileId={setProfileId}
            modules={modules}
            loading={loadingModules}
            selected={selected}
            onToggle={toggleModule}
            onNext={() => setStep(2)}
          />
        </>
      )}

      {step === 2 && (
        <StepParams
          hintedFields={hintedFields}
          name={name} setName={setName}
          website={website} setWebsite={setWebsite}
          cnpj={cnpj} setCnpj={setCnpj}
          ticker={ticker} setTicker={setTicker}
          aliases={aliases} setAliases={setAliases}
          excludeTerms={excludeTerms} setExcludeTerms={setExcludeTerms}
          strictMatch={strictMatch} setStrictMatch={setStrictMatch}
          canProceed={canProceedStep2}
          running={running}
          error={error}
          onBack={() => setStep(1)}
          onRun={() => runQuery(false)}
        />
      )}

      {step === 3 && running && mode === "profile" && (
        <BriefingLoading
          profileLabel={profiles.find((p) => p.id === profileId)?.label ?? ""}
          moduleCount={selected.size}
        />
      )}

      {step === 3 && !running && briefing && (
        <StepBriefing
          briefing={briefing}
          onBack={() => setStep(2)}
          onReset={resetAll}
          onRefresh={() => runQuery(true)}
          refreshing={running}
        />
      )}

      {step === 3 && !briefing && result && (
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
    <div className="flex flex-wrap items-center gap-2 mb-6">
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

function StepOne({
  mode, setMode, profiles, profileId, setProfileId,
  modules, loading, selected, onToggle, onNext,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  profiles: BriefingProfile[];
  profileId: string | null;
  setProfileId: (id: string | null) => void;
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
  const canAdvance = mode === "profile" ? !!profileId : selected.size > 0;
  return (
    <div>
      <div className="flex items-center gap-1 p-1 rounded-full bg-surface border border-border mb-4 w-fit">
        <button
          onClick={() => setMode("profile")}
          className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium transition-all ${
            mode === "profile" ? "bg-text text-background" : "text-text-muted hover:text-text"
          }`}
        >
          <Sparkles className="w-3 h-3" /> Perfis prontos
        </button>
        <button
          onClick={() => setMode("custom")}
          className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium transition-all ${
            mode === "custom" ? "bg-text text-background" : "text-text-muted hover:text-text"
          }`}
        >
          <SlidersHorizontal className="w-3 h-3" /> Módulos à la carte
        </button>
        <Link
          href="/manage/briefing-profiles"
          className="ml-1 flex items-center gap-1 h-8 px-2.5 rounded-full text-[11px] text-text-muted hover:text-text hover:bg-background transition-colors"
          title="Gerenciar perfis"
        >
          <Settings2 className="w-3 h-3" />
        </Link>
      </div>

      {mode === "profile" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
          {profiles.length === 0 && (
            <p className="col-span-full text-[13px] text-text-muted py-10 text-center">
              Nenhum perfil cadastrado.
            </p>
          )}
          {profiles.map((p) => {
            const isSelected = profileId === p.id;
            const moduleLabels = p.module_ids
              .map((id) => modules.find((m) => m.id === id)?.label ?? id)
              .slice(0, 4);
            const extra = p.module_ids.length - moduleLabels.length;
            return (
              <button
                key={p.id}
                onClick={() => setProfileId(p.id)}
                className={`text-left p-3.5 rounded-[14px] border transition-all active:scale-[0.99] ${
                  isSelected ? "border-primary/60 bg-primary/5" : "border-border bg-surface hover:border-text-muted/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="text-[14px] font-semibold leading-tight">{p.label}</p>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-primary border-primary text-white" : "border-border"
                  }`}>
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
                {p.description && (
                  <p className="text-[12px] text-text-muted leading-snug mb-2">{p.description}</p>
                )}
                <div className="flex flex-wrap gap-1 mb-2">
                  {moduleLabels.map((label) => (
                    <span key={label} className="text-[10px] px-1.5 h-4 inline-flex items-center rounded-full bg-background text-text-secondary">
                      {label}
                    </span>
                  ))}
                  {extra > 0 && (
                    <span className="text-[10px] px-1.5 h-4 inline-flex items-center rounded-full bg-background text-text-muted">
                      +{extra}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-text-muted">
                  <span>{p.module_ids.length} módulos</span>
                  <span>·</span>
                  <span>{p.output_sections.length} seções</span>
                  {p.is_builtin && <><span>·</span><span>padrão</span></>}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
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
      )}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-text-muted">
          {mode === "profile"
            ? profileId ? "1 perfil selecionado" : "Escolha um perfil"
            : `${selected.size} fonte${selected.size === 1 ? "" : "s"} selecionada${selected.size === 1 ? "" : "s"}`}
        </p>
        <Button onClick={onNext} className="rounded-full" disabled={!canAdvance}>
          Continuar <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function StepParams({
  hintedFields,
  name, setName, website, setWebsite, cnpj, setCnpj, ticker, setTicker, aliases, setAliases,
  excludeTerms, setExcludeTerms, strictMatch, setStrictMatch,
  canProceed, running, error, onBack, onRun,
}: {
  hintedFields: Set<EntityField>;
  name: string; setName: (v: string) => void;
  website: string; setWebsite: (v: string) => void;
  cnpj: string; setCnpj: (v: string) => void;
  ticker: string; setTicker: (v: string) => void;
  aliases: string; setAliases: (v: string) => void;
  excludeTerms: string; setExcludeTerms: (v: string) => void;
  strictMatch: boolean; setStrictMatch: (v: boolean) => void;
  canProceed: boolean;
  running: boolean;
  error: string | null;
  onBack: () => void;
  onRun: () => void;
}) {
  const inputClass = "w-full px-3 py-2.5 rounded-[10px] bg-background border border-border text-[14px] text-text outline-none focus:border-primary transition-colors";
  return (
    <div>
      <div className="p-4 rounded-[14px] border border-border bg-surface mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-3">Identificação do alvo</p>
        <Field label="Nome da empresa ou pessoa" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Cielo, Nubank, Acme S.A."
            className={inputClass}
            autoFocus
          />
        </Field>
        <p className="text-[11px] text-text-muted leading-snug -mt-1">
          O único campo obrigatório. Os opcionais abaixo refinam a pesquisa — se ficarem em branco, a plataforma tenta descobri-los sozinha com base no nome.
        </p>
      </div>

      <div className="p-4 rounded-[14px] border border-border bg-surface mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Opcionais (melhoram a precisão)</p>
          {hintedFields.size > 0 && (
            <span className="text-[10px] text-text-muted">
              recomendados: {Array.from(hintedFields).map((f) => f === "website" ? "Site" : f === "cnpj" ? "CNPJ" : f === "ticker" ? "Ticker" : "Apelidos").join(" · ")}
            </span>
          )}
        </div>
        <Field label="Site oficial" hint={hintedFields.has("website") ? "recomendado" : undefined}>
          <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" className={inputClass} />
        </Field>
        <Field label="CNPJ" hint={hintedFields.has("cnpj") ? "recomendado · 14 dígitos" : "14 dígitos"}>
          <input type="text" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" className={inputClass} />
        </Field>
        <Field label="Ticker" hint={hintedFields.has("ticker") ? "recomendado para empresas listadas" : undefined}>
          <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="PETR4" className={inputClass} />
        </Field>
        <Field label="Apelidos / variações" hint="Separados por vírgula">
          <input type="text" value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="Acme Corp, Acme Brasil" className={inputClass} />
        </Field>
      </div>

      <div className="p-4 rounded-[14px] border border-border bg-surface mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-3">Filtro de relevância</p>
        <label className="flex items-start gap-2.5 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={strictMatch}
            onChange={(e) => setStrictMatch(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-primary"
          />
          <div>
            <p className="text-[13px] font-medium">Busca estrita</p>
            <p className="text-[11px] text-text-muted leading-snug">
              Descarta resultados que não mencionem o nome, apelidos ou domínio informados. Reduz falsos positivos com nomes parecidos.
            </p>
          </div>
        </label>
        <Field label="Palavras para excluir" hint="Separadas por vírgula">
          <input
            type="text"
            value={excludeTerms}
            onChange={(e) => setExcludeTerms(e.target.value)}
            placeholder="resort, hotel, turismo"
            className="w-full px-3 py-2.5 rounded-[10px] bg-background border border-border text-[14px] text-text outline-none focus:border-primary transition-colors"
          />
        </Field>
      </div>

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

function hostOf(url?: string): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

function fmtDate(d?: string): string | null {
  if (!d) return null;
  if (/^\d{8}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return d.slice(0, 10);
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
  const totalItems = result.modules.reduce(
    (s, m) => s + m.blocks.reduce((bb, b) => bb + (b.items?.length ?? (b.meta ? Object.keys(b.meta).length : 1)), 0),
    0,
  );
  return (
    <div>
      <div className="p-4 rounded-[14px] border border-border bg-surface mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Alvo</p>
            <p className="text-[18px] font-semibold break-words leading-tight">{result.entity.name}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} loading={refreshing} className="rounded-full shrink-0">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {result.entity.website && (
            <Chip>
              site: {result.entity.website}
              {result.discovery?.discovered.includes("website") && <span className="ml-1 text-primary">auto</span>}
            </Chip>
          )}
          {result.entity.cnpj && (
            <Chip>
              CNPJ: {result.entity.cnpj}
              {result.discovery?.discovered.includes("cnpj") && <span className="ml-1 text-primary">auto</span>}
            </Chip>
          )}
          {result.entity.ticker && <Chip>ticker: {result.entity.ticker}</Chip>}
          {result.relevance?.strict && <Chip>busca estrita</Chip>}
          {result.relevance?.excludeTerms && result.relevance.excludeTerms.length > 0 && (
            <Chip>excluir: {result.relevance.excludeTerms.join(", ")}</Chip>
          )}
          <Chip>{result.modules.length} módulos · {totalItems} itens · {(result.durationMs / 1000).toFixed(1)}s</Chip>
        </div>
      </div>

      {result.modules.length === 0 && (
        <div className="text-center py-12 text-text-muted text-[13px]">
          Nenhuma fonte retornou dados relevantes. Tente afrouxar a busca estrita ou remover palavras de exclusão.
        </div>
      )}

      <div className="flex flex-col gap-3 mb-6">
        {result.modules.map((m) => {
          const count = m.blocks.reduce((s, b) => s + (b.items?.length ?? (b.meta ? Object.keys(b.meta).length : 1)), 0);
          return (
            <details key={m.moduleId} open className="rounded-[14px] border border-border bg-surface overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer flex items-center justify-between list-none">
                <span className="text-[14px] font-semibold">{m.moduleLabel}</span>
                <span className="text-[11px] text-text-muted">{count} {count === 1 ? "item" : "itens"}</span>
              </summary>
              <div className="border-t border-border divide-y divide-border">
                {m.blocks.map((b, i) => (
                  <BlockView key={`${m.moduleId}-${b.providerId}-${i}`} block={b} />
                ))}
              </div>
            </details>
          );
        })}
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

function BlockView({ block }: { block: ResearchBlock }) {
  const hasItems = Array.isArray(block.items) && block.items.length > 0;
  const hasMeta = block.meta && Object.keys(block.meta).length > 0;
  return (
    <div className="px-4 py-3.5 min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2.5">
        <span className="text-[13px] font-semibold break-words min-w-0">{block.label}</span>
        <span className="text-[10px] text-text-muted px-1.5 h-4 inline-flex items-center rounded-full bg-background break-all max-w-full">
          {block.providerId}
        </span>
        {hasItems && <span className="text-[10px] text-text-muted ml-auto shrink-0">{block.items!.length} resultados</span>}
      </div>
      {hasItems ? (
        <ul className="flex flex-col gap-2">
          {block.items!.map((it, i) => (
            <ItemCard key={i} item={it} />
          ))}
        </ul>
      ) : hasMeta ? (
        <dl className="flex flex-col gap-2 text-[12px] sm:grid sm:grid-cols-[minmax(100px,max-content)_1fr] sm:gap-x-3 sm:gap-y-1">
          {Object.entries(block.meta!).map(([k, v]) => (
            <div key={k} className="sm:contents">
              <dt className="text-text-muted font-medium">{k}</dt>
              <dd className="text-text-secondary break-words min-w-0">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-[12px] text-text-secondary whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed">
          {block.text}
        </p>
      )}
    </div>
  );
}

function ItemCard({ item }: { item: ParsedItem }) {
  const host = hostOf(item.url);
  const date = fmtDate(item.date);
  return (
    <li className="p-3 rounded-[10px] border border-border bg-background hover:border-text-muted/40 transition-colors overflow-hidden">
      <div className="flex items-start gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium leading-snug hover:text-primary inline-flex items-start gap-1 group"
            >
              <span className="line-clamp-2">{item.title}</span>
              <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ) : (
            <p className="text-[13px] font-medium leading-snug">{item.title}</p>
          )}
          {item.snippet && (
            <p className="text-[12px] text-text-secondary mt-1 leading-snug line-clamp-3">{item.snippet}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-text-muted">
            {(item.source || host) && <span>{item.source || host}</span>}
            {date && <><span>·</span><span>{date}</span></>}
          </div>
        </div>
      </div>
    </li>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 min-h-5 py-0.5 rounded-full bg-background text-text-secondary max-w-full break-all">
      {children}
    </span>
  );
}

function HistoryPanel({
  items, onOpen, onDelete,
}: {
  items: QueryRunListItem[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <details className="mb-5 rounded-[14px] border border-border bg-surface overflow-hidden" open>
      <summary className="px-4 py-3 cursor-pointer flex items-center justify-between list-none hover:bg-surface-light/40 transition-colors">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <History className="w-3.5 h-3.5 text-text-muted" />
          Histórico de consultas
        </span>
        <span className="text-[11px] text-text-muted">{items.length} {items.length === 1 ? "item" : "itens"}</span>
      </summary>
      <ul className="border-t border-border divide-y divide-border max-h-72 overflow-y-auto">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 px-3 py-2 hover:bg-background/40 transition-colors">
            <button
              onClick={() => onOpen(it.id)}
              className="flex-1 min-w-0 text-left"
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13px] font-medium truncate">{it.entity_name}</span>
                {it.profile_label ? (
                  <span className="text-[10px] px-1.5 h-4 inline-flex items-center rounded-full bg-primary/10 text-primary font-normal">
                    {it.profile_label}
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 h-4 inline-flex items-center rounded-full bg-background text-text-muted">
                    {it.module_ids.length} módulos
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-text-muted">
                <span>{formatRunDate(it.created_at)}</span>
                {it.duration_ms && <span>· {(it.duration_ms / 1000).toFixed(1)}s</span>}
                {it.entity?.website && <span>· {hostOnly(it.entity.website)}</span>}
                {it.entity?.cnpj && <span>· {formatCnpj(it.entity.cnpj)}</span>}
              </div>
            </button>
            <button
              onClick={() => onDelete(it.id)}
              className="w-7 h-7 flex items-center justify-center rounded-full text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
              title="Remover do histórico"
              aria-label="Remover"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

function formatRunDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffS = Math.floor((now - d.getTime()) / 1000);
  if (diffS < 60) return "agora";
  if (diffS < 3600) return `${Math.floor(diffS / 60)}min atrás`;
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h atrás`;
  if (diffS < 604800) return `${Math.floor(diffS / 86400)}d atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

function hostOnly(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function formatCnpj(v: string): string {
  const d = v.replace(/\D/g, "");
  if (d.length !== 14) return v;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function BriefingLoading({ profileLabel, moduleCount }: { profileLabel: string; moduleCount: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(t);
  }, []);
  const phases = [
    { from: 0, label: "Coletando fontes de pesquisa…" },
    { from: 15, label: "Agregando provedores e filtrando relevância…" },
    { from: 35, label: "Sintetizando com Claude…" },
    { from: 70, label: "Finalizando — gere uma coisa grande leva mais tempo…" },
  ];
  const current = [...phases].reverse().find((p) => elapsed >= p.from) ?? phases[0];
  return (
    <div className="py-12 flex flex-col items-center text-center">
      <div className="w-12 h-12 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
      <p className="text-[15px] font-semibold mb-1">Gerando briefing · {profileLabel}</p>
      <p className="text-[12px] text-text-muted mb-4">{moduleCount} módulos · ~60s típico</p>
      <div className="w-full max-w-sm">
        <div className="h-1.5 rounded-full bg-surface overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${Math.min(95, Math.round((elapsed / 75) * 100))}%` }}
          />
        </div>
        <p className="text-[11px] text-text-muted mt-2">{current.label} <span className="text-text-muted/70">({elapsed}s)</span></p>
      </div>
    </div>
  );
}

function briefingToMarkdown(b: BriefingResponse): string {
  const lines: string[] = [];
  lines.push(`# ${b.entity.name} — ${b.profile.label}`);
  if (b.entity.website) lines.push(`Site: ${b.entity.website}`);
  if (b.entity.cnpj) lines.push(`CNPJ: ${b.entity.cnpj}`);
  lines.push(`Modelo: ${b.modelUsed} · ${(b.durationMs / 1000).toFixed(1)}s`);
  lines.push("");
  for (const sec of b.sections) {
    const v = b.content[sec.id];
    const empty = v == null || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v ?? {}).length === 0) || v === "";
    lines.push(`## ${sec.title}`);
    if (empty) {
      lines.push("_não encontrado_\n");
      continue;
    }
    if (sec.kind === "paragraph") {
      lines.push(String(v));
    } else if (sec.kind === "list") {
      for (const it of v as unknown[]) lines.push(`- ${typeof it === "string" ? it : JSON.stringify(it)}`);
    } else {
      for (const [k, vv] of Object.entries(v as Record<string, unknown>)) {
        lines.push(`- **${k}**: ${typeof vv === "string" ? vv : JSON.stringify(vv)}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function StepBriefing({
  briefing, onBack, onReset, onRefresh, refreshing,
}: {
  briefing: BriefingResponse;
  onBack: () => void;
  onReset: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const totalSources = briefing.modules.reduce(
    (s, m) => s + m.blocks.reduce((bb, b) => bb + (b.items?.length ?? 1), 0),
    0,
  );
  const sectionStats = briefing.sections.map((sec) => {
    const v = briefing.content[sec.id];
    const empty = v == null || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v ?? {}).length === 0) || v === "";
    return { sec, empty };
  });
  const filledCount = sectionStats.filter((s) => !s.empty).length;

  async function copyMarkdown() {
    await navigator.clipboard.writeText(briefingToMarkdown(briefing));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  function downloadMarkdown() {
    const md = briefingToMarkdown(briefing);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = briefing.entity.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    a.href = url;
    a.download = `briefing-${safeName}-${briefing.profile.slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function scrollTo(id: string) {
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      <div className="p-4 rounded-[14px] border border-border bg-surface mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Briefing · {briefing.profile.label}
            </p>
            <p className="text-[18px] font-semibold break-words leading-tight">{briefing.entity.name}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <button
              onClick={copyMarkdown}
              className="h-8 px-2.5 flex items-center gap-1 rounded-full text-[11px] border border-border bg-background text-text-secondary hover:text-text hover:border-text-muted/50 transition-colors"
              title="Copiar como markdown"
            >
              {copied ? <CheckCheck className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              {copied ? "copiado" : "copiar"}
            </button>
            <button
              onClick={downloadMarkdown}
              className="h-8 px-2.5 flex items-center gap-1 rounded-full text-[11px] border border-border bg-background text-text-secondary hover:text-text hover:border-text-muted/50 transition-colors"
              title="Baixar .md"
            >
              <FileDown className="w-3 h-3" /> .md
            </button>
            <Button variant="outline" size="sm" onClick={onRefresh} loading={refreshing} className="rounded-full">
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {briefing.entity.website && (
            <Chip>
              site: {briefing.entity.website}
              {briefing.discovery?.discovered.includes("website") && <span className="ml-1 text-primary">auto</span>}
            </Chip>
          )}
          {briefing.entity.cnpj && (
            <Chip>
              CNPJ: {briefing.entity.cnpj}
              {briefing.discovery?.discovered.includes("cnpj") && <span className="ml-1 text-primary">auto</span>}
            </Chip>
          )}
          <Chip>{filledCount}/{briefing.sections.length} seções preenchidas</Chip>
          <Chip>{totalSources} fontes · {(briefing.durationMs / 1000).toFixed(1)}s</Chip>
          <Chip>{briefing.modelUsed}</Chip>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        {/* TOC */}
        <nav className="lg:w-[200px] shrink-0 lg:sticky lg:top-4 self-start">
          <div className="p-3 rounded-[14px] border border-border bg-surface">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-2">
              <ListTree className="w-3 h-3" /> Seções
            </p>
            <ul className="flex flex-col gap-0.5">
              {sectionStats.map(({ sec, empty }) => (
                <li key={sec.id}>
                  <button
                    onClick={() => scrollTo(sec.id)}
                    className={`w-full text-left text-[12px] px-2 py-1 rounded-md hover:bg-background transition-colors flex items-center justify-between gap-2 ${
                      empty ? "text-text-muted" : "text-text"
                    }`}
                  >
                    <span className="truncate">{sec.title}</span>
                    {empty && <span className="text-[9px] text-text-muted shrink-0">—</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {briefing.sections.map((sec) => (
            <div id={`sec-${sec.id}`} key={sec.id} className="scroll-mt-4">
              <SectionCard section={sec} value={briefing.content[sec.id]} />
            </div>
          ))}
        </div>
      </div>

      <details className="mb-5 rounded-[14px] border border-border bg-surface">
        <summary className="px-4 py-3 cursor-pointer text-[13px] font-semibold list-none flex items-center justify-between">
          <span>Dados de pesquisa brutos</span>
          <span className="text-[11px] text-text-muted">{briefing.modules.length} módulos · {totalSources} itens</span>
        </summary>
        <div className="border-t border-border divide-y divide-border">
          {briefing.modules.map((m) => (
            <details key={m.moduleId} className="group">
              <summary className="px-4 py-2.5 cursor-pointer text-[12px] flex items-center justify-between list-none hover:bg-background/50">
                <span className="font-medium">{m.moduleLabel}</span>
                <span className="text-text-muted">{m.blocks.reduce((s, b) => s + (b.items?.length ?? 1), 0)} itens</span>
              </summary>
              <div className="px-4 pb-3 divide-y divide-border">
                {m.blocks.map((b, i) => (
                  <BlockView key={`${m.moduleId}-${b.providerId}-${i}`} block={b} />
                ))}
              </div>
            </details>
          ))}
        </div>
      </details>

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

function SectionCard({ section, value }: { section: OutputSection; value: unknown }) {
  const empty = value == null || (Array.isArray(value) && value.length === 0) || (typeof value === "object" && !Array.isArray(value) && Object.keys(value ?? {}).length === 0) || value === "";
  const count = section.kind === "list" && Array.isArray(value) ? value.length
    : section.kind === "keyvalue" && value && typeof value === "object" ? Object.keys(value as object).length
    : null;
  return (
    <section className={`p-4 rounded-[14px] border ${empty ? "border-border/60 bg-surface/40" : "border-border bg-surface"} overflow-hidden`}>
      <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
        <h3 className="text-[13px] font-semibold tracking-tight break-words min-w-0">{section.title}</h3>
        {count !== null && !empty && (
          <span className="text-[10px] text-text-muted">{count} {section.kind === "list" ? (count === 1 ? "item" : "itens") : (count === 1 ? "campo" : "campos")}</span>
        )}
        {empty && <span className="text-[10px] text-text-muted uppercase tracking-wide">vazio</span>}
      </div>
      {empty ? (
        <p className="text-[12px] text-text-muted">Nenhum dado encontrado para essa seção. Tente afrouxar a busca estrita ou rodar com <em>Atualizar</em>.</p>
      ) : section.kind === "paragraph" ? (
        <p className="text-[13.5px] text-text leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{String(value)}</p>
      ) : section.kind === "list" ? (
        <ul className="flex flex-col gap-1.5 text-[13px]">
          {(value as unknown[]).map((item, i) => (
            <li key={i} className="flex gap-2 min-w-0">
              <span className="text-primary font-semibold shrink-0 leading-snug">·</span>
              <span className="text-text leading-snug break-words [overflow-wrap:anywhere] min-w-0">{typeof item === "string" ? item : JSON.stringify(item)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <dl className="flex flex-col gap-2.5 text-[13px] sm:grid sm:grid-cols-[minmax(130px,max-content)_1fr] sm:gap-x-3 sm:gap-y-1">
          {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 sm:contents">
              <dt className="text-text-muted font-medium text-[11px] uppercase tracking-wide sm:text-[13px] sm:normal-case sm:tracking-normal">{k}</dt>
              <dd className="text-text break-words [overflow-wrap:anywhere] min-w-0">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
