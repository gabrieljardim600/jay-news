"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Loader2, Plus, Trash2, Save, ChevronDown, ChevronUp } from "lucide-react";

type OutputSection = { id: string; title: string; kind: "paragraph" | "list" | "keyvalue"; hint?: string };

type Profile = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  icon: string | null;
  module_ids: string[];
  synth_prompt: string;
  output_sections: OutputSection[];
  is_builtin: boolean;
  sort_order: number;
};

type ModuleMeta = { id: string; label: string };

export default function BriefingProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [modules, setModules] = useState<ModuleMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    const [p, m] = await Promise.all([
      fetch("/api/briefing-profiles").then((r) => r.ok ? r.json() : []),
      fetch("/api/query/modules").then((r) => r.ok ? r.json() : []),
    ]);
    setProfiles(p);
    setModules(m);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function saveProfile(p: Profile) {
    const res = await fetch(`/api/briefing-profiles/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: p.label,
        description: p.description,
        module_ids: p.module_ids,
        synth_prompt: p.synth_prompt,
        output_sections: p.output_sections,
        sort_order: p.sort_order,
      }),
    });
    if (res.ok) await load();
    else alert("Erro ao salvar: " + (await res.text()));
  }

  async function deleteProfile(p: Profile) {
    if (!confirm(`Excluir o perfil "${p.label}"?`)) return;
    const res = await fetch(`/api/briefing-profiles/${p.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function createProfile() {
    const label = prompt("Nome do novo perfil");
    if (!label) return;
    const slug = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const res = await fetch("/api/briefing-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        label,
        description: "",
        module_ids: [],
        synth_prompt: "Você é analista competitivo. Produza um briefing factual.",
        output_sections: [
          { id: "resumo", title: "Resumo", kind: "paragraph" },
        ],
        sort_order: 200,
      }),
    });
    if (res.ok) {
      const p: Profile = await res.json();
      await load();
      setOpenId(p.id);
    } else {
      alert("Erro: " + (await res.text()));
    }
  }

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8 pb-20">
      <AppHeader rightSlot={
        <Button onClick={createProfile} className="ml-1 rounded-full h-9 px-4 gap-1.5 text-[13px]">
          <Plus className="w-3.5 h-3.5" /> Novo
        </Button>
      } />
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Perfis de briefing</p>
        <p className="text-[13px] text-text-secondary mt-0.5">
          Cada perfil bundla módulos de pesquisa + prompt + seções de saída. Use em Consulta ou no briefing do concorrente.
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {profiles.map((p) => (
            <ProfileRow
              key={p.id}
              profile={p}
              modules={modules}
              open={openId === p.id}
              onToggle={() => setOpenId(openId === p.id ? null : p.id)}
              onSave={saveProfile}
              onDelete={() => deleteProfile(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileRow({
  profile, modules, open, onToggle, onSave, onDelete,
}: {
  profile: Profile;
  modules: ModuleMeta[];
  open: boolean;
  onToggle: () => void;
  onSave: (p: Profile) => void | Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Profile>(profile);
  useEffect(() => setDraft(profile), [profile]);

  function toggleModule(id: string) {
    setDraft((d) => {
      const has = d.module_ids.includes(id);
      return { ...d, module_ids: has ? d.module_ids.filter((x) => x !== id) : [...d.module_ids, id] };
    });
  }

  function updateSection(idx: number, patch: Partial<OutputSection>) {
    setDraft((d) => ({
      ...d,
      output_sections: d.output_sections.map((s, i) => i === idx ? { ...s, ...patch } : s),
    }));
  }
  function addSection() {
    setDraft((d) => ({
      ...d,
      output_sections: [...d.output_sections, { id: `secao_${d.output_sections.length + 1}`, title: "Nova seção", kind: "paragraph" }],
    }));
  }
  function removeSection(idx: number) {
    setDraft((d) => ({ ...d, output_sections: d.output_sections.filter((_, i) => i !== idx) }));
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-light transition-colors"
      >
        <div className="min-w-0">
          <p className="text-[14px] font-semibold truncate">{profile.label}</p>
          {profile.description && <p className="text-[12px] text-text-muted truncate mt-0.5">{profile.description}</p>}
          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-text-muted">
            <span>{profile.module_ids.length} módulos</span>
            <span>·</span>
            <span>{profile.output_sections.length} seções</span>
            {profile.is_builtin && <><span>·</span><span>padrão</span></>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-text-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border p-4 flex flex-col gap-4">
          <Field label="Nome">
            <input className="input-field" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </Field>
          <Field label="Descrição">
            <input className="input-field" value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>

          <div>
            <p className="text-[12px] font-medium text-text-secondary mb-2">Módulos de pesquisa</p>
            <div className="flex flex-wrap gap-1.5">
              {modules.map((m) => {
                const on = draft.module_ids.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleModule(m.id)}
                    className={`px-2.5 h-7 rounded-full text-[11px] border transition-all ${
                      on ? "bg-primary text-white border-primary" : "bg-background border-border text-text-secondary hover:border-text-muted/50"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Prompt de síntese (Claude)">
            <textarea
              className="input-field min-h-[120px] resize-y leading-relaxed"
              value={draft.synth_prompt}
              onChange={(e) => setDraft({ ...draft, synth_prompt: e.target.value })}
            />
          </Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-medium text-text-secondary">Seções de saída</p>
              <button onClick={addSection} className="text-[11px] text-primary hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> seção
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {draft.output_sections.map((s, i) => (
                <div key={i} className="p-2.5 rounded-[10px] border border-border bg-background flex flex-col gap-1.5">
                  <div className="flex gap-1.5">
                    <input
                      className="input-field flex-1"
                      placeholder="id (ex.: produtos)"
                      value={s.id}
                      onChange={(e) => updateSection(i, { id: e.target.value })}
                    />
                    <input
                      className="input-field flex-1"
                      placeholder="Título"
                      value={s.title}
                      onChange={(e) => updateSection(i, { title: e.target.value })}
                    />
                    <select
                      className="input-field w-[110px]"
                      value={s.kind}
                      onChange={(e) => updateSection(i, { kind: e.target.value as OutputSection["kind"] })}
                    >
                      <option value="paragraph">texto</option>
                      <option value="list">lista</option>
                      <option value="keyvalue">chave-valor</option>
                    </select>
                    <button onClick={() => removeSection(i)} className="h-9 w-9 flex items-center justify-center text-text-muted hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    className="input-field"
                    placeholder="Hint (instrução extra pro Claude)"
                    value={s.hint ?? ""}
                    onChange={(e) => updateSection(i, { hint: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            {!profile.is_builtin ? (
              <Button variant="ghost" onClick={onDelete} className="text-red-500 hover:bg-red-500/10 rounded-full">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir
              </Button>
            ) : <span className="text-[11px] text-text-muted">perfil padrão — pode editar, não pode excluir</span>}
            <Button onClick={() => onSave(draft)} className="rounded-full">
              <Save className="w-3.5 h-3.5 mr-1.5" /> Salvar
            </Button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input-field {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          background: var(--color-background);
          border: 1px solid var(--color-border);
          font-size: 13px;
          color: var(--color-text);
          outline: none;
        }
        .input-field:focus { border-color: var(--color-primary); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-text-secondary mb-1.5">{label}</span>
      {children}
    </label>
  );
}
