"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, X, Loader2, Plus, Zap, Globe } from "lucide-react";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Intent = "inspiration" | "whitelabel" | "competitor";
type Engine = "light" | "deep";

interface Parceiro {
  id: string;
  nome: string;
  nomeFantasia: string | null;
  site: string | null;
  cidade: string | null;
  estado: string | null;
}

export default function NewBrandWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [url, setUrl] = useState("");
  const [candidateUrls, setCandidateUrls] = useState<string[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [newUrl, setNewUrl] = useState("");
  const [intent, setIntent] = useState<Intent>("inspiration");
  const [engine, setEngine] = useState<Engine>("light");
  const [parceiroId, setParceiroId] = useState<string | null>(null);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [parceiroSearch, setParceiroSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function goToStep2() {
    if (!url.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/brands/crawl-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao descobrir URLs");
      setCandidateUrls(data.urls ?? []);
      setSelectedUrls(new Set(data.urls ?? []));
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (step !== 3) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      const params = new URLSearchParams();
      if (parceiroSearch) params.set("q", parceiroSearch);
      const res = await fetch(`/api/brands/parceiros?${params.toString()}`, {
        signal: controller.signal,
      });
      if (res.ok) setParceiros(await res.json());
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [parceiroSearch, step]);

  async function submit() {
    if (selectedUrls.size === 0) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          urls: Array.from(selectedUrls),
          intent,
          engine,
          parceiro_id: parceiroId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao criar scrape");
      router.push(`/brands/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setLoading(false);
    }
  }

  function addManualUrl() {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    const normalized = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    if (selectedUrls.has(normalized)) return;
    setSelectedUrls(new Set([...selectedUrls, normalized]));
    setCandidateUrls([...candidateUrls, normalized]);
    setNewUrl("");
  }

  function toggleUrl(u: string) {
    const next = new Set(selectedUrls);
    if (next.has(u)) next.delete(u);
    else next.add(u);
    setSelectedUrls(next);
  }

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-5 py-8 pb-20">
      <AppHeader />

      <Link
        href="/brands"
        className="inline-flex items-center gap-1 text-text-muted text-[13px] mb-4 hover:text-text"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Brands
      </Link>

      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Novo scrape — passo {step} de 3
        </p>
        <div className="flex gap-1 mt-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full ${s <= step ? "bg-primary" : "bg-surface"}`}
            />
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h1 className="text-[22px] font-bold">Qual site você quer scrapear?</h1>
          <p className="text-[13px] text-text-secondary">
            Cole a URL raiz. O Jay News descobre as páginas principais automaticamente no próximo passo.
          </p>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://btgpactual.com"
            onKeyDown={(e) => {
              if (e.key === "Enter" && url.trim()) goToStep2();
            }}
            autoFocus
          />
          {error && <p className="text-[13px] text-danger">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={goToStep2} loading={loading} disabled={!url.trim()}>
              Próximo
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h1 className="text-[22px] font-bold">Confirma as páginas</h1>
          <p className="text-[13px] text-text-secondary">
            Detectei {candidateUrls.length} páginas. Marca/desmarca o que quiser.
          </p>

          <div className="space-y-1 max-h-80 overflow-auto p-2 bg-surface rounded-[10px] border border-border">
            {candidateUrls.map((u) => {
              const checked = selectedUrls.has(u);
              return (
                <button
                  key={u}
                  onClick={() => toggleUrl(u)}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded text-left hover:bg-surface-light transition ${
                    checked ? "" : "opacity-50"
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-primary border-primary" : "border-border"}`}>
                    {checked && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-[13px] truncate">{u}</span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="adicionar URL manual"
              onKeyDown={(e) => {
                if (e.key === "Enter") addManualUrl();
              }}
              className="flex-1"
            />
            <Button variant="outline" onClick={addManualUrl} disabled={!newUrl.trim()}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
            <Button onClick={() => setStep(3)} disabled={selectedUrls.size === 0}>
              Próximo ({selectedUrls.size})
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <h1 className="text-[22px] font-bold">Configuração final</h1>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-muted mb-2">Engine</p>
            <div className="grid grid-cols-2 gap-2">
              <EngineCard
                active={engine === "light"}
                onClick={() => setEngine("light")}
                icon={<Globe className="w-4 h-4" />}
                title="Light"
                desc="Fetch + HTML parse. Rápido (30-60s)."
              />
              <EngineCard
                active={engine === "deep"}
                onClick={() => setEngine("deep")}
                icon={<Zap className="w-4 h-4" />}
                title="Deep"
                desc="Puppeteer + screenshots. Pesado (3-5min). Requer worker."
              />
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-muted mb-2">Intent</p>
            <div className="flex gap-2">
              {(["inspiration", "whitelabel", "competitor"] as Intent[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setIntent(opt)}
                  className={`px-3 py-1.5 rounded-full text-[12px] transition ${
                    intent === opt
                      ? "bg-primary text-white"
                      : "bg-surface text-text-secondary hover:text-text"
                  }`}
                >
                  {labelFor(opt)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-muted mb-2">
              Parceiro (opcional)
            </p>
            <Input
              value={parceiroSearch}
              onChange={(e) => setParceiroSearch(e.target.value)}
              placeholder="buscar parceiro…"
            />
            {parceiroId && (
              <div className="mt-2 flex items-center gap-2 p-2 rounded-[8px] bg-surface border border-border">
                <Check className="w-3.5 h-3.5 text-primary" />
                <span className="text-[13px] flex-1">
                  {parceiros.find((p) => p.id === parceiroId)?.nome ?? parceiroId}
                </span>
                <button onClick={() => setParceiroId(null)} className="text-text-muted hover:text-text">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {!parceiroId && parceiros.length > 0 && (
              <div className="mt-2 max-h-48 overflow-auto rounded-[8px] bg-surface border border-border">
                {parceiros.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setParceiroId(p.id)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-light transition border-b border-border last:border-0"
                  >
                    <p className="text-[13px] font-medium">{p.nome}</p>
                    <p className="text-[11px] text-text-muted">
                      {p.site ?? ""}{p.cidade ? ` · ${p.cidade}/${p.estado}` : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-[13px] text-danger">{error}</p>}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>Voltar</Button>
            <Button onClick={submit} loading={loading}>
              {engine === "deep" ? "Enfileirar" : "Executar"}
            </Button>
          </div>
        </div>
      )}

      {loading && step === 1 && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-surface p-6 rounded-[12px] border border-border flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-[14px]">Descobrindo páginas…</span>
          </div>
        </div>
      )}
    </div>
  );
}

function EngineCard({
  active, onClick, icon, title, desc,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-[10px] border text-left transition ${
        active
          ? "border-primary bg-primary/5"
          : "border-border bg-surface hover:border-primary/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={active ? "text-primary" : "text-text-muted"}>{icon}</div>
        <span className="text-[14px] font-semibold">{title}</span>
      </div>
      <p className="text-[11px] text-text-muted leading-snug">{desc}</p>
    </button>
  );
}

function labelFor(intent: Intent): string {
  switch (intent) {
    case "whitelabel": return "Whitelabel";
    case "inspiration": return "Inspiração";
    case "competitor": return "Competitor";
  }
}
