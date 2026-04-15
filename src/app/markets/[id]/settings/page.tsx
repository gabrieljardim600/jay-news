"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Save, Trash2, Plus, X, Sparkles, Rss, Globe, Building2, Power,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ChipInput } from "@/components/ui/ChipInput";

type Competitor = {
  id: string;
  name: string;
  website: string | null;
  aliases: string[];
  ai_suggested: boolean;
  enabled: boolean;
};

type Source = {
  id: string;
  name: string;
  url: string;
  source_type: "rss" | "web";
  ai_suggested: boolean;
  enabled: boolean;
};

type Subtopic = { id: string; label: string };

type ResearchModuleInfo = {
  id: string;
  label: string;
  description: string;
  always_on: boolean;
  providers: { id: string; label: string; description: string | null }[];
};

type MarketDetail = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  language: string;
  research_modules: string[];
  market_subtopics: Subtopic[];
  market_competitors: Competitor[];
  market_sources: Source[];
};

const EMOJI_OPTIONS = ["📊", "💰", "💳", "📈", "🏦", "🛒", "🚀", "🧠", "🏥", "🏗️", "⚽", "🎮"];
const COLOR_OPTIONS = ["#007AFF", "#5856D6", "#FF9500", "#34C759", "#FF3B30", "#AF8F3E"];

type TabId = "basics" | "subtopics" | "competitors" | "sources" | "modules" | "danger";

export default function MarketSettingsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const marketId = params?.id;

  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("basics");

  const load = useCallback(async () => {
    if (!marketId) return;
    const res = await fetch(`/api/markets/${marketId}`);
    if (res.ok) setMarket(await res.json());
    setLoading(false);
  }, [marketId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="min-h-screen max-w-3xl mx-auto px-5 py-10 text-text-muted text-[14px]">Carregando...</div>;
  if (!market || !marketId) return <div className="min-h-screen max-w-3xl mx-auto px-5 py-10 text-text-muted text-[14px]">Market não encontrado.</div>;

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-10 pb-20">
      <header className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push(`/markets/${marketId}`)}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-secondary"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
        </button>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Configurações</h1>
          <p className="text-text-muted text-[13px]">{market.icon} {market.name}</p>
        </div>
      </header>

      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {([
          { id: "basics" as TabId, label: "Geral" },
          { id: "subtopics" as TabId, label: "Sub-tópicos" },
          { id: "competitors" as TabId, label: "Concorrentes" },
          { id: "sources" as TabId, label: "Fontes" },
          { id: "modules" as TabId, label: "Módulos de pesquisa" },
          { id: "danger" as TabId, label: "Excluir" },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-[13px] font-medium transition-colors border-b-2 whitespace-nowrap ${
              tab === t.id ? "border-primary text-text" : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "basics" && <BasicsTab market={market} onSaved={load} />}
      {tab === "subtopics" && <SubtopicsTab marketId={marketId} subtopics={market.market_subtopics} onChange={load} />}
      {tab === "competitors" && <CompetitorsTab marketId={marketId} marketName={market.name} language={market.language} subtopicsLabels={market.market_subtopics.map(s => s.label)} competitors={market.market_competitors} onChange={load} />}
      {tab === "sources" && <SourcesTab marketId={marketId} marketName={market.name} language={market.language} subtopicsLabels={market.market_subtopics.map(s => s.label)} sources={market.market_sources} onChange={load} />}
      {tab === "modules" && <ModulesTab marketId={marketId} selected={market.research_modules} onChange={load} />}
      {tab === "danger" && <DangerTab marketId={marketId} marketName={market.name} />}
    </div>
  );
}

function BasicsTab({ market, onSaved }: { market: MarketDetail; onSaved: () => void }) {
  const [name, setName] = useState(market.name);
  const [description, setDescription] = useState(market.description || "");
  const [icon, setIcon] = useState(market.icon);
  const [color, setColor] = useState(market.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/markets/${market.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null, icon, color }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error || `Erro ao salvar (${res.status})`);
      setSaving(false);
      return;
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="flex flex-col gap-5 max-w-xl">
      <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
      <div>
        <label className="text-[13px] text-text-secondary font-medium mb-2 block">Descrição</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-[10px] bg-surface border border-border px-3 py-2.5 text-[14px] text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
        />
      </div>

      <div>
        <label className="text-[13px] text-text-secondary font-medium mb-2.5 block">Ícone</label>
        <div className="flex flex-wrap gap-1.5">
          {EMOJI_OPTIONS.map((e) => (
            <button
              key={e}
              onClick={() => setIcon(e)}
              className={`w-10 h-10 rounded-[10px] text-xl flex items-center justify-center ${icon === e ? "bg-primary/15 ring-2 ring-primary" : "bg-surface hover:bg-surface-light"}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[13px] text-text-secondary font-medium mb-2.5 block">Cor</label>
        <div className="flex flex-wrap gap-2.5">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`w-8 h-8 rounded-full transition-all ${color === c ? "ring-2 ring-text ring-offset-2 ring-offset-background" : "hover:scale-105"}`}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-[12px] text-danger font-medium">{error}</p>}
      <Button onClick={handleSave} loading={saving} className="self-start rounded-full px-5 gap-1.5">
        <Save className="w-4 h-4" /> Salvar
      </Button>
    </div>
  );
}

function SubtopicsTab({ marketId, subtopics, onChange }: { marketId: string; subtopics: Subtopic[]; onChange: () => void }) {
  const [labels, setLabels] = useState<string[]>(subtopics.map((s) => s.label));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);

    const existingByLabel = new Map(subtopics.map((s) => [s.label.toLowerCase(), s]));
    const desired = new Set(labels.map((l) => l.toLowerCase()));

    const toAdd = labels.filter((l) => !existingByLabel.has(l.toLowerCase()));
    const toRemove = subtopics.filter((s) => !desired.has(s.label.toLowerCase()));

    try {
      // Add first — if anything fails, user keeps previous subtopics
      if (toAdd.length > 0) {
        const r = await fetch(`/api/markets/${marketId}/subtopics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ labels: toAdd }),
        });
        if (!r.ok) throw new Error(`Não foi possível adicionar: ${(await r.json().catch(() => ({}))).error || r.statusText}`);
      }

      for (const s of toRemove) {
        await fetch(`/api/markets/${marketId}/subtopics?subtopicId=${s.id}`, { method: "DELETE" });
      }
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <p className="text-[13px] text-text-secondary">
        Sub-tópicos direcionam a relevância das buscas. Não segmentam visualmente o feed.
      </p>
      <ChipInput values={labels} onChange={setLabels} placeholder="day trade, PIX, parcelamento..." />
      {error && <p className="text-[12px] text-danger font-medium">{error}</p>}
      <Button onClick={handleSave} loading={saving} className="self-start rounded-full px-5 gap-1.5">
        <Save className="w-4 h-4" /> Salvar
      </Button>
    </div>
  );
}

function CompetitorsTab({
  marketId, marketName, language, subtopicsLabels, competitors, onChange,
}: {
  marketId: string; marketName: string; language: string; subtopicsLabels: string[];
  competitors: Competitor[]; onChange: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ name: string; website?: string; description?: string }[]>([]);

  async function addManual() {
    if (!newName.trim()) return;
    await fetch(`/api/markets/${marketId}/competitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), website: newWebsite.trim() || null }),
    });
    setNewName(""); setNewWebsite("");
    onChange();
  }

  async function toggle(c: Competitor) {
    await fetch(`/api/markets/${marketId}/competitors`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitorId: c.id, enabled: !c.enabled }),
    });
    onChange();
  }

  async function remove(c: Competitor) {
    if (!confirm(`Remover "${c.name}"?`)) return;
    await fetch(`/api/markets/${marketId}/competitors?competitorId=${c.id}`, { method: "DELETE" });
    onChange();
  }

  async function suggest() {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const res = await fetch("/api/markets/suggest-competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketName, subtopics: subtopicsLabels, language }),
      });
      const data = await res.json();
      const list = Array.isArray(data.suggestions) ? data.suggestions : [];
      setSuggestions(list.filter((s: { name: string }) => !competitors.some((c) => c.name.toLowerCase() === s.name.toLowerCase())));
    } finally {
      setSuggesting(false);
    }
  }

  async function addSuggestion(s: { name: string; website?: string }) {
    await fetch(`/api/markets/${marketId}/competitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: s.name, website: s.website || null, ai_suggested: true }),
    });
    setSuggestions((prev) => prev.filter((x) => x.name !== s.name));
    onChange();
  }

  return (
    <div className="flex flex-col gap-5 max-w-xl">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome" />
        <Input value={newWebsite} onChange={(e) => setNewWebsite(e.target.value)} placeholder="site.com.br" />
        <button
          onClick={addManual}
          disabled={!newName.trim()}
          className="h-10 px-4 rounded-[10px] bg-primary text-white text-[13px] font-medium flex items-center gap-1.5 disabled:opacity-40 hover:bg-primary-hover"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      <button
        onClick={suggest}
        disabled={suggesting}
        className="self-start flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary-hover disabled:opacity-40"
      >
        {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        Sugerir mais com IA
      </button>

      {suggestions.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">Sugestões</p>
          <div className="flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.name}
                onClick={() => addSuggestion(s)}
                className="text-left flex items-start gap-2 p-2.5 rounded-[10px] border border-border hover:border-primary/40 hover:bg-primary/5"
              >
                <Plus className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium">{s.name}</p>
                  {s.website && <p className="text-[11px] text-text-muted truncate">{s.website}</p>}
                  {s.description && <p className="text-[11px] text-text-secondary line-clamp-1">{s.description}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {competitors.map((c) => (
          <div key={c.id} className={`flex items-center gap-2 p-2.5 rounded-[10px] bg-surface border border-border ${!c.enabled ? "opacity-50" : ""}`}>
            <Building2 className="w-4 h-4 text-text-muted shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate">{c.name}</p>
              {c.website && <p className="text-[11px] text-text-muted truncate">{c.website}</p>}
            </div>
            {c.ai_suggested && <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">IA</span>}
            <button
              onClick={() => toggle(c)}
              title={c.enabled ? "Pausar" : "Ativar"}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${c.enabled ? "text-success hover:bg-success/10" : "text-text-muted hover:bg-surface-light"}`}
            >
              <Power className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => remove(c)} className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourcesTab({
  marketId, marketName, language, subtopicsLabels, sources, onChange,
}: {
  marketId: string; marketName: string; language: string; subtopicsLabels: string[];
  sources: Source[]; onChange: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newType, setNewType] = useState<"rss" | "web">("web");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ name: string; url: string; source_type: "rss" | "web" }[]>([]);

  async function addManual() {
    if (!newName.trim() || !newUrl.trim()) return;
    await fetch(`/api/markets/${marketId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), url: newUrl.trim(), source_type: newType }),
    });
    setNewName(""); setNewUrl("");
    onChange();
  }

  async function remove(s: Source) {
    if (!confirm(`Remover fonte "${s.name}"?`)) return;
    await fetch(`/api/markets/${marketId}/sources?sourceId=${s.id}`, { method: "DELETE" });
    onChange();
  }

  async function suggest() {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const res = await fetch("/api/markets/suggest-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketName, subtopics: subtopicsLabels, language }),
      });
      const data = await res.json();
      const list = Array.isArray(data.suggestions) ? data.suggestions : [];
      setSuggestions(list.filter((s: { url: string }) => !sources.some((x) => x.url === s.url)));
    } finally {
      setSuggesting(false);
    }
  }

  async function addSuggestion(s: { name: string; url: string; source_type: "rss" | "web" }) {
    await fetch(`/api/markets/${marketId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...s, ai_suggested: true }),
    });
    setSuggestions((prev) => prev.filter((x) => x.url !== s.url));
    onChange();
  }

  return (
    <div className="flex flex-col gap-5 max-w-xl">
      <p className="text-[13px] text-text-secondary">
        Fontes restringem a busca. Se vazio, a IA escolhe durante a coleta.
      </p>

      <div className="grid grid-cols-[1fr_1.5fr_auto_auto] gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome" />
        <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://site.com/feed" />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as "rss" | "web")}
          className="h-10 px-3 rounded-[10px] bg-surface border border-border text-[13px]"
        >
          <option value="web">Web</option>
          <option value="rss">RSS</option>
        </select>
        <button
          onClick={addManual}
          disabled={!newName.trim() || !newUrl.trim()}
          className="h-10 px-4 rounded-[10px] bg-primary text-white text-[13px] font-medium flex items-center gap-1.5 disabled:opacity-40 hover:bg-primary-hover"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      <button
        onClick={suggest}
        disabled={suggesting}
        className="self-start flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary-hover disabled:opacity-40"
      >
        {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        Sugerir mais com IA
      </button>

      {suggestions.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">Sugestões</p>
          <div className="flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.url}
                onClick={() => addSuggestion(s)}
                className="text-left flex items-start gap-2 p-2.5 rounded-[10px] border border-border hover:border-primary/40 hover:bg-primary/5"
              >
                <Plus className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                {s.source_type === "rss" ? <Rss className="w-4 h-4 text-text-muted mt-0.5" /> : <Globe className="w-4 h-4 text-text-muted mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium">{s.name}</p>
                  <p className="text-[11px] text-text-muted truncate">{s.url}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {sources.map((s) => (
          <div key={s.id} className={`flex items-center gap-2 p-2.5 rounded-[10px] bg-surface border border-border ${!s.enabled ? "opacity-50" : ""}`}>
            {s.source_type === "rss" ? <Rss className="w-4 h-4 text-text-muted shrink-0" /> : <Globe className="w-4 h-4 text-text-muted shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate">{s.name}</p>
              <p className="text-[11px] text-text-muted truncate">{s.url}</p>
            </div>
            {s.ai_suggested && <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">IA</span>}
            <button onClick={() => remove(s)} className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModulesTab({ marketId, selected, onChange }: { marketId: string; selected: string[]; onChange: () => void }) {
  const [modules, setModules] = useState<ResearchModuleInfo[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set(selected));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/markets/research-modules");
      if (r.ok) setModules(await r.json());
    })();
  }, []);

  function toggle(id: string, alwaysOn: boolean) {
    if (alwaysOn) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const list = modules.filter((m) => m.always_on || picked.has(m.id)).map((m) => m.id);
    const r = await fetch(`/api/markets/${marketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ research_modules: list }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      setError(err.error || `Erro (${r.status})`);
      setSaving(false);
      return;
    }
    setSaving(false);
    onChange();
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <p className="text-[13px] text-text-secondary">
        Ative os módulos de pesquisa que devem rodar ao gerar um briefing deste market.
        O núcleo (web + Wikipedia + site + brapi) está sempre ativo. Cada módulo roda providers
        específicos em paralelo.
      </p>

      {modules.length === 0 ? (
        <p className="text-[13px] text-text-muted">Carregando módulos...</p>
      ) : (
        <div className="flex flex-col gap-2">
          {modules.map((m) => {
            const isOn = m.always_on || picked.has(m.id);
            return (
              <button
                key={m.id}
                type="button"
                disabled={m.always_on}
                onClick={() => toggle(m.id, m.always_on)}
                className={`text-left p-3 rounded-[12px] border transition-all ${
                  isOn
                    ? "bg-primary/5 border-primary/40"
                    : "bg-surface border-border hover:border-primary/30"
                } ${m.always_on ? "opacity-80 cursor-default" : "cursor-pointer"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold">{m.label}</p>
                      {m.always_on && <span className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded">sempre ativo</span>}
                    </div>
                    <p className="text-[12px] text-text-secondary mt-0.5">{m.description}</p>
                    {m.providers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {m.providers.map((p) => (
                          <span key={p.id} className="text-[10px] text-text-muted bg-background border border-border rounded px-1.5 py-0.5" title={p.description ?? ""}>
                            {p.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                    isOn ? "bg-primary border-primary" : "border-border"
                  }`}>
                    {isOn && <Save className="w-2.5 h-2.5 text-white" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="text-[12px] text-danger font-medium">{error}</p>}

      <Button onClick={save} loading={saving} className="self-start rounded-full px-5 gap-1.5">
        <Save className="w-4 h-4" /> Salvar seleção
      </Button>
    </div>
  );
}

function DangerTab({ marketId, marketName }: { marketId: string; marketName: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Tem certeza que deseja excluir "${marketName}"? Isso remove o market, artigos e briefings relacionados.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/markets/${marketId}`, { method: "DELETE" });
    if (res.ok) router.push("/markets");
    else setDeleting(false);
  }

  return (
    <div className="max-w-xl">
      <div className="p-4 rounded-[12px] border border-danger/30 bg-danger/5">
        <h3 className="text-[14px] font-semibold mb-1 text-danger">Excluir market</h3>
        <p className="text-[12px] text-text-secondary mb-4">
          O market fica inativo (soft delete). Concorrentes, fontes, artigos coletados e briefings permanecem no banco mas deixam de aparecer.
        </p>
        <Button onClick={handleDelete} loading={deleting} className="bg-danger hover:bg-danger text-white rounded-full px-5 gap-1.5">
          <Trash2 className="w-4 h-4" /> Excluir
        </Button>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
