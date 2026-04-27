"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { RefreshCw, Plus, Trash2, ExternalLink, Sparkles, FileText, Camera, ThumbsUp, Megaphone, AlertCircle, CheckCircle2 } from "lucide-react";
import { AppHeader } from "@/components/ui/AppHeader";
import { relativeDate } from "@/lib/utils/relative-date";
import type { SocialBrandTarget, SocialBrandPlatform } from "@/lib/social-brand/types";

interface FeedItem {
  id: string;
  target_id: string;
  external_id: string;
  kind: string;
  platform: string;
  caption: string | null;
  permalink: string | null;
  posted_at: string | null;
  media: { url: string; thumbnail_url?: string; type: string }[];
  archive: { public_url: string; mime_type: string }[];
  social_brand_targets: { label: string };
}

interface Briefing {
  id: string;
  date: string;
  summary: string;
  highlights: { brand: string; platform: string; kind: string; caption_excerpt: string; permalink: string | null }[];
  posts_count: number;
  ads_count: number;
  targets_count: number;
}

const PLATFORM_META: Record<SocialBrandPlatform, { label: string; icon: typeof Camera; color: string }> = {
  instagram: { label: "Instagram", icon: Camera, color: "#E1306C" },
  facebook_page: { label: "Facebook", icon: ThumbsUp, color: "#1877F2" },
  meta_ads: { label: "Meta Ads", icon: Megaphone, color: "#fb830e" },
  tiktok: { label: "TikTok", icon: Sparkles, color: "#000" },
};

export default function BrandsPage() {
  const [tab, setTab] = useState<"feed" | "briefing">("feed");
  const [targets, setTargets] = useState<SocialBrandTarget[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, fRes, bRes] = await Promise.all([
      fetch("/api/social-brand/targets").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/social-brand/feed").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/social-brand/briefings").then((r) => (r.ok ? r.json() : [])),
    ]);
    setTargets(Array.isArray(tRes) ? tRes : []);
    setFeed(Array.isArray(fRes) ? fRes : []);
    setBriefings(Array.isArray(bRes) ? bRes : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function syncAll() {
    setSyncing(true);
    try {
      await fetch("/api/social-brand/sync", { method: "POST" });
      await load();
    } finally { setSyncing(false); }
  }

  async function generateBriefing() {
    setSyncing(true);
    try {
      await fetch("/api/social-brand/briefings", { method: "POST" });
      await load();
    } finally { setSyncing(false); }
  }

  async function removeTarget(id: string) {
    if (!confirm("Remover essa marca do tracking?")) return;
    await fetch(`/api/social-brand/targets?id=${id}`, { method: "DELETE" });
    await load();
  }

  const filtered = filter === "all" ? feed : feed.filter((f) => f.target_id === filter);

  const rightSlot = (
    <div className="flex items-center gap-2">
      <button
        onClick={syncAll}
        disabled={syncing || targets.length === 0}
        className="h-9 px-3 flex items-center gap-2 rounded-full bg-primary text-white text-[13px] font-medium hover:bg-primary-hover disabled:opacity-60 active:scale-[0.97]"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
        Sync
      </button>
      <button
        onClick={() => setAddOpen(true)}
        className="h-9 px-3 flex items-center gap-2 rounded-full bg-surface hover:bg-surface-light text-[13px] font-medium"
      >
        <Plus className="w-3.5 h-3.5" /> Marca
      </button>
    </div>
  );

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8 pb-28">
      <AppHeader rightSlot={rightSlot} />

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-border">
          <TabButton active={tab === "feed"} onClick={() => setTab("feed")} label="Feed" />
          <TabButton active={tab === "briefing"} onClick={() => setTab("briefing")} label="Briefing" />
        </div>
      </div>

      {/* TARGETS BAR */}
      {targets.length > 0 && tab === "feed" && (
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-2">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="Todos" />
          {targets.map((t) => (
            <FilterChip
              key={t.id}
              active={filter === t.id}
              onClick={() => setFilter(t.id)}
              label={t.label}
              platform={t.platform}
              syncStatus={t.last_sync_status}
              onRemove={() => removeTarget(t.id)}
            />
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : tab === "feed" ? (
        targets.length === 0 ? (
          <EmptyState
            title="Nenhuma marca em tracking"
            hint='Clique em "Marca" pra adicionar a primeira (Instagram, Facebook ou Meta Ads).'
            cta={() => setAddOpen(true)}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Sem posts ainda"
            hint='Clique em "Sync" pra coletar agora. Ou aguarde o cron de meio-dia.'
          />
        ) : (
          <div className="flex flex-col">
            {filtered.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        )
      ) : (
        <BriefingView briefings={briefings} onGenerate={generateBriefing} loading={syncing} />
      )}

      {addOpen && (
        <AddTargetModal
          onClose={() => setAddOpen(false)}
          onAdded={async () => { setAddOpen(false); await load(); }}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 rounded-full text-[13px] font-medium ${
        active ? "bg-text text-background shadow-sm" : "text-text-muted hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}

function FilterChip({
  active, onClick, label, platform, syncStatus, onRemove,
}: {
  active: boolean; onClick: () => void; label: string;
  platform?: SocialBrandPlatform; syncStatus?: string | null;
  onRemove?: () => void;
}) {
  const meta = platform ? PLATFORM_META[platform] : null;
  const Icon = meta?.icon;
  return (
    <div className={`shrink-0 inline-flex items-center gap-1.5 h-8 pl-3 pr-1 rounded-full text-[12px] font-medium border transition-colors ${active ? "bg-text text-background border-text" : "bg-surface border-border text-text-secondary hover:text-text"}`}>
      <button onClick={onClick} className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" style={{ color: active ? undefined : meta?.color }} />}
        <span>{label}</span>
        {syncStatus === "error" && <AlertCircle className="w-3 h-3 text-danger" />}
        {syncStatus === "ok" && <CheckCircle2 className="w-3 h-3 text-success" />}
      </button>
      {onRemove && (
        <button onClick={onRemove} className="ml-1 w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-light opacity-60 hover:opacity-100">
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function PostCard({ post }: { post: FeedItem }) {
  const meta = PLATFORM_META[post.platform as SocialBrandPlatform];
  const Icon = meta?.icon ?? Camera;
  const cover = post.archive[0]?.public_url ?? post.media[0]?.thumbnail_url ?? post.media[0]?.url;
  return (
    <article className="py-4 border-b border-border last:border-0">
      <div className="flex items-start gap-3">
        {cover ? (
          <div className="w-16 h-16 rounded-lg bg-surface overflow-hidden shrink-0 relative">
            <Image src={cover} alt="" fill sizes="64px" className="object-cover" unoptimized />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-surface flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-text-muted" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[13px] font-semibold text-text">{post.social_brand_targets?.label}</span>
            <span className="text-[10px] uppercase tracking-wider text-text-muted px-1.5 py-0.5 rounded bg-surface">{post.kind}</span>
            {post.posted_at && (
              <span className="text-[11px] text-text-muted">{relativeDate(post.posted_at)}</span>
            )}
          </div>
          {post.caption && (
            <p className="text-[13px] text-text-secondary line-clamp-3 whitespace-pre-wrap">{post.caption}</p>
          )}
          {post.permalink && (
            <a href={post.permalink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-primary">
              <ExternalLink className="w-3 h-3" /> ver original
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function BriefingView({ briefings, onGenerate, loading }: { briefings: Briefing[]; onGenerate: () => void; loading: boolean }) {
  const latest = briefings[0];
  return (
    <div>
      <button
        onClick={onGenerate}
        disabled={loading}
        className="mb-5 h-9 px-3 inline-flex items-center gap-2 rounded-full bg-primary text-white text-[13px] font-medium hover:bg-primary-hover disabled:opacity-60"
      >
        <FileText className="w-3.5 h-3.5" />
        {loading ? "Gerando..." : "Gerar briefing agora"}
      </button>
      {!latest ? (
        <EmptyState title="Nenhum briefing ainda" hint='Adicione marcas, sincronize, e gere o primeiro briefing.' />
      ) : (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3 mb-3 text-[12px] text-text-muted">
            <span>{latest.date}</span>
            <span>·</span>
            <span>{latest.posts_count} posts</span>
            <span>·</span>
            <span>{latest.ads_count} ads</span>
            <span>·</span>
            <span>{latest.targets_count} marcas</span>
          </div>
          <div className="prose prose-sm prose-invert max-w-none text-text whitespace-pre-wrap text-[14px] leading-relaxed">{latest.summary}</div>
          {latest.highlights.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border">
              <div className="text-[11px] uppercase tracking-wider text-text-muted mb-2">Destaques</div>
              <div className="flex flex-col gap-2">
                {latest.highlights.slice(0, 10).map((h, i) => (
                  <div key={i} className="text-[12px] text-text-secondary">
                    <span className="font-medium text-text">{h.brand}</span>
                    <span className="text-text-muted"> · {h.platform}/{h.kind}</span>
                    {h.caption_excerpt && <span> — {h.caption_excerpt}</span>}
                    {h.permalink && (
                      <a href={h.permalink} target="_blank" rel="noreferrer" className="ml-2 text-primary inline-flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {briefings.length > 1 && (
        <details className="mt-4 text-[12px] text-text-muted">
          <summary className="cursor-pointer">Briefings anteriores ({briefings.length - 1})</summary>
          <div className="mt-2 flex flex-col gap-2">
            {briefings.slice(1, 10).map((b) => (
              <div key={b.id} className="text-[12px]">
                <span className="text-text">{b.date}</span> — {b.posts_count} posts · {b.ads_count} ads
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function EmptyState({ title, hint, cta }: { title: string; hint: string; cta?: () => void }) {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
        <Megaphone className="w-6 h-6 text-text-muted" />
      </div>
      <p className="text-text-secondary text-[17px] font-medium mb-1">{title}</p>
      <p className="text-text-muted text-[14px]">{hint}</p>
      {cta && (
        <button onClick={cta} className="mt-4 h-9 px-4 rounded-full bg-primary text-white text-[13px] font-medium">
          Adicionar marca
        </button>
      )}
    </div>
  );
}

interface NicheSuggestion {
  label: string;
  instagram_handle?: string;
  facebook_page?: string;
  ad_library_query?: string;
  reason: string;
}

function AddTargetModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [mode, setMode] = useState<"manual" | "suggest">("manual");
  const [platform, setPlatform] = useState<SocialBrandPlatform>("instagram");
  const [identifier, setIdentifier] = useState("");
  const [label, setLabel] = useState("");
  const [niche, setNiche] = useState("");
  const [trackMode, setTrackMode] = useState<"news_only" | "archive_posts">("archive_posts");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<NicheSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function add(t: { platform: SocialBrandPlatform; identifier: string; label: string; niche?: string }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/social-brand/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...t, mode: trackMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally { setBusy(false); }
  }

  async function handleManual() {
    if (!identifier.trim() || !label.trim()) {
      setError("Preencha identifier e label.");
      return;
    }
    const ok = await add({ platform, identifier: identifier.trim(), label: label.trim(), niche: niche.trim() || undefined });
    if (ok) onAdded();
  }

  async function handleSuggest() {
    if (!niche.trim()) { setError("Informe um nicho."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/social-brand/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: niche.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setSuggestions(data.suggestions ?? []);
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  async function applySuggestion(s: NicheSuggestion) {
    let added = 0;
    if (s.instagram_handle) {
      if (await add({ platform: "instagram", identifier: s.instagram_handle, label: s.label, niche })) added++;
    }
    if (s.facebook_page) {
      if (await add({ platform: "facebook_page", identifier: s.facebook_page, label: s.label, niche })) added++;
    }
    if (s.ad_library_query) {
      if (await add({ platform: "meta_ads", identifier: s.ad_library_query, label: s.label, niche })) added++;
    }
    if (added > 0) onAdded();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">Adicionar marca</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text text-[20px] leading-none">×</button>
        </div>

        <div className="p-5">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-border mb-4">
            <TabButton active={mode === "manual"} onClick={() => setMode("manual")} label="Manual" />
            <TabButton active={mode === "suggest"} onClick={() => setMode("suggest")} label="Sugerir do nicho" />
          </div>

          <div className="mb-3">
            <label className="text-[12px] text-text-muted mb-1 block">Modo de tracking</label>
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-border w-full">
              <button onClick={() => setTrackMode("archive_posts")} className={`flex-1 h-8 rounded-full text-[12px] font-medium ${trackMode === "archive_posts" ? "bg-text text-background" : "text-text-muted"}`}>Arquivar posts</button>
              <button onClick={() => setTrackMode("news_only")} className={`flex-1 h-8 rounded-full text-[12px] font-medium ${trackMode === "news_only" ? "bg-text text-background" : "text-text-muted"}`}>Só novidades</button>
            </div>
            <p className="text-[11px] text-text-muted mt-1">
              {trackMode === "archive_posts" ? "Baixa imagens/vídeos e mantém histórico." : "Salva só metadado/caption — sem mídia."}
            </p>
          </div>

          {mode === "manual" ? (
            <>
              <Field label="Plataforma">
                <select value={platform} onChange={(e) => setPlatform(e.target.value as SocialBrandPlatform)} className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px]">
                  <option value="instagram">Instagram (Business/Creator pública) ✓</option>
                  <option value="facebook_page">Facebook Page (requer review do app)</option>
                  <option value="meta_ads">Meta Ad Library (requer verificação de identidade)</option>
                </select>
                {platform === "facebook_page" && (
                  <p className="text-[11px] text-warning mt-1">⚠ App precisa de &quot;Page Public Content Access&quot; aprovado pela Meta. Submeta pra review em developers.facebook.com.</p>
                )}
                {platform === "meta_ads" && (
                  <p className="text-[11px] text-warning mt-1">⚠ Confirme identidade em facebook.com/ads/library/api antes de usar.</p>
                )}
              </Field>
              <Field label={platform === "meta_ads" ? "Termo de busca ou page:<id>" : "Username / page slug"}>
                <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={platform === "instagram" ? "natura" : platform === "facebook_page" ? "natura" : "natura  ou  page:1234567890"} className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px]" />
              </Field>
              <Field label="Label">
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Natura" className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px]" />
              </Field>
              <Field label="Nicho (opcional)">
                <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="cosméticos, fintech, edtech..." className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px]" />
              </Field>
              {error && <p className="text-[12px] text-danger mb-2">{error}</p>}
              <button onClick={handleManual} disabled={busy} className="w-full h-10 rounded-lg bg-primary text-white font-medium disabled:opacity-60">{busy ? "Adicionando..." : "Adicionar"}</button>
            </>
          ) : (
            <>
              <Field label="Nicho">
                <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="ex: trading, edtech BR, fitness" className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px]" />
              </Field>
              <button onClick={handleSuggest} disabled={busy} className="w-full h-10 rounded-lg bg-primary text-white font-medium disabled:opacity-60 mb-3">
                {busy ? "Buscando..." : "Sugerir marcas"}
              </button>
              {error && <p className="text-[12px] text-danger mb-2">{error}</p>}
              <div className="flex flex-col gap-2">
                {suggestions.map((s, i) => (
                  <div key={i} className="border border-border rounded-lg p-3">
                    <div className="font-medium text-[13px] text-text mb-1">{s.label}</div>
                    <div className="text-[11px] text-text-muted mb-2">{s.reason}</div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {s.instagram_handle && <span className="text-[11px] px-2 py-0.5 rounded bg-surface">IG: {s.instagram_handle}</span>}
                      {s.facebook_page && <span className="text-[11px] px-2 py-0.5 rounded bg-surface">FB: {s.facebook_page}</span>}
                      {s.ad_library_query && <span className="text-[11px] px-2 py-0.5 rounded bg-surface">Ads: {s.ad_library_query}</span>}
                    </div>
                    <button onClick={() => applySuggestion(s)} disabled={busy} className="text-[12px] text-primary hover:underline disabled:opacity-60">+ adicionar todas plataformas</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="text-[12px] text-text-muted mb-1 block">{label}</label>
      {children}
    </div>
  );
}
