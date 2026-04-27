"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  RefreshCw, Plus, Trash2, ExternalLink, Sparkles, FileText, Camera, ThumbsUp, Megaphone,
  AlertCircle, CheckCircle2, Pencil, Heart, MessageCircle, Eye, ImageIcon, X, ChevronLeft, ChevronRight, Search,
  Database, ArrowDownToLine,
} from "lucide-react";
import { AppHeader } from "@/components/ui/AppHeader";
import { relativeDate } from "@/lib/utils/relative-date";
import type { SocialBrandTarget, SocialBrandPlatform, SocialBrandMode } from "@/lib/social-brand/types";

// ─── types ──────────────────────────────────────────────────────────────────
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
  metrics: Record<string, number>;
  social_brand_targets: { label: string; profile?: Record<string, unknown> };
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

interface TargetWithProfile extends SocialBrandTarget {
  profile: {
    name?: string;
    biography?: string;
    profile_picture_url?: string;
    followers_count?: number;
    media_count?: number;
  };
}

// ─── platform meta ──────────────────────────────────────────────────────────
const PLATFORM_META: Record<SocialBrandPlatform, { label: string; icon: typeof Camera; color: string }> = {
  instagram: { label: "Instagram", icon: Camera, color: "#E1306C" },
  facebook_page: { label: "Facebook", icon: ThumbsUp, color: "#1877F2" },
  meta_ads: { label: "Meta Ads", icon: Megaphone, color: "#fb830e" },
  tiktok: { label: "TikTok", icon: Sparkles, color: "#000" },
};

// ─── main page ──────────────────────────────────────────────────────────────
export default function BrandsPage() {
  const [tab, setTab] = useState<"feed" | "targets" | "briefing">("feed");
  const [targets, setTargets] = useState<TargetWithProfile[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalSync, setGlobalSync] = useState(false);
  const [perTargetSync, setPerTargetSync] = useState<Record<string, boolean>>({});
  const [briefingBusy, setBriefingBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<TargetWithProfile | null>(null);
  const [filterTarget, setFilterTarget] = useState<string>("all");
  const [filterKind, setFilterKind] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [lightbox, setLightbox] = useState<{ post: FeedItem; index: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, fRes, bRes] = await Promise.all([
      fetch("/api/social-brand/targets").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/social-brand/feed?limit=200").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/social-brand/briefings").then((r) => (r.ok ? r.json() : [])),
    ]);
    setTargets(Array.isArray(tRes) ? tRes : []);
    setFeed(Array.isArray(fRes) ? fRes : []);
    setBriefings(Array.isArray(bRes) ? bRes : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function syncAll() {
    setGlobalSync(true);
    try { await fetch("/api/social-brand/sync", { method: "POST" }); await load(); }
    finally { setGlobalSync(false); }
  }

  async function syncOne(id: string) {
    setPerTargetSync((s) => ({ ...s, [id]: true }));
    try {
      await fetch("/api/social-brand/sync", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: id }),
      });
      await load();
    } finally { setPerTargetSync((s) => ({ ...s, [id]: false })); }
  }

  async function generateBriefing() {
    setBriefingBusy(true);
    try { await fetch("/api/social-brand/briefings", { method: "POST" }); await load(); }
    finally { setBriefingBusy(false); }
  }

  async function removeTarget(id: string) {
    if (!confirm("Remover essa marca do tracking?")) return;
    await fetch(`/api/social-brand/targets?id=${id}`, { method: "DELETE" });
    await load();
  }

  // ─── derived ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let f = feed;
    if (filterTarget !== "all") f = f.filter((p) => p.target_id === filterTarget);
    if (filterKind !== "all") f = f.filter((p) => p.kind === filterKind);
    if (search.trim()) {
      const q = search.toLowerCase();
      f = f.filter((p) =>
        (p.caption ?? "").toLowerCase().includes(q) ||
        p.social_brand_targets?.label?.toLowerCase().includes(q),
      );
    }
    return f;
  }, [feed, filterTarget, filterKind, search]);

  const stats = useMemo(() => {
    const totalArchived = feed.reduce((acc, p) => acc + p.archive.length, 0);
    const lastSync = targets
      .map((t) => t.last_synced_at)
      .filter(Boolean)
      .sort()
      .at(-1);
    return {
      brands: targets.length,
      posts: feed.length,
      archived: totalArchived,
      lastSync,
    };
  }, [feed, targets]);

  const rightSlot = (
    <div className="flex items-center gap-2">
      <button
        onClick={syncAll}
        disabled={globalSync || targets.length === 0}
        className="h-9 px-3 flex items-center gap-2 rounded-full bg-primary text-white text-[13px] font-medium hover:bg-primary-hover disabled:opacity-60 active:scale-[0.97]"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${globalSync ? "animate-spin" : ""}`} />
        {globalSync ? "Sync..." : "Sync"}
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

      {/* STATS BAR */}
      {targets.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-5">
          <Stat icon={Megaphone} label="Marcas" value={stats.brands} />
          <Stat icon={Database} label="Posts" value={stats.posts} />
          <Stat icon={ArrowDownToLine} label="Arquivos" value={stats.archived} />
          <Stat icon={RefreshCw} label="Última" value={stats.lastSync ? relativeDate(stats.lastSync) : "—"} small />
        </div>
      )}

      {/* TABS */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-border">
          <TabButton active={tab === "feed"} onClick={() => setTab("feed")} label="Feed" />
          <TabButton active={tab === "targets"} onClick={() => setTab("targets")} label="Marcas" badge={targets.length} />
          <TabButton active={tab === "briefing"} onClick={() => setTab("briefing")} label="Briefing" badge={briefings.length} />
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : tab === "targets" ? (
        targets.length === 0 ? (
          <EmptyState title="Nenhuma marca em tracking" hint='Adicione a primeira: Instagram, FB Page ou Meta Ads.' cta={() => setAddOpen(true)} />
        ) : (
          <div className="flex flex-col gap-3">
            {targets.map((t) => (
              <TargetCard
                key={t.id}
                target={t}
                postCount={feed.filter((p) => p.target_id === t.id).length}
                syncing={!!perTargetSync[t.id]}
                onSync={() => syncOne(t.id)}
                onEdit={() => setEditing(t)}
                onRemove={() => removeTarget(t.id)}
                onViewFeed={() => { setFilterTarget(t.id); setTab("feed"); }}
              />
            ))}
          </div>
        )
      ) : tab === "feed" ? (
        targets.length === 0 ? (
          <EmptyState title="Nenhuma marca em tracking" hint='Clique em "Marca" pra adicionar a primeira.' cta={() => setAddOpen(true)} />
        ) : (
          <>
            {/* FILTERS */}
            <div className="flex flex-col gap-2 mb-4">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar caption, marca..."
                  className="w-full h-9 pl-9 pr-3 bg-surface border border-border rounded-lg text-[13px] focus:border-primary outline-none"
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <FilterChip active={filterTarget === "all"} onClick={() => setFilterTarget("all")} label="Todas marcas" />
                {targets.map((t) => (
                  <FilterChip key={t.id} active={filterTarget === t.id} onClick={() => setFilterTarget(t.id)} label={t.label} platform={t.platform} />
                ))}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {(["all", "post", "reel", "video", "ad"] as const).map((k) => (
                  <FilterChip key={k} active={filterKind === k} onClick={() => setFilterKind(k)} label={k === "all" ? "Todos tipos" : k} small />
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState title="Sem posts pra esses filtros" hint='Ajuste filtros ou clique em "Sync".' />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filtered.map((p) => <PostCard key={p.id} post={p} onClick={() => setLightbox({ post: p, index: 0 })} />)}
              </div>
            )}
          </>
        )
      ) : (
        <BriefingView briefings={briefings} onGenerate={generateBriefing} loading={briefingBusy} />
      )}

      {addOpen && <AddTargetModal onClose={() => setAddOpen(false)} onAdded={async () => { setAddOpen(false); await load(); }} />}
      {editing && <EditTargetModal target={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
      {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} onNav={(idx) => setLightbox({ post: lightbox.post, index: idx })} />}
    </div>
  );
}

// ─── components ─────────────────────────────────────────────────────────────
function Stat({ icon: Icon, label, value, small }: { icon: typeof Camera; label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-xl bg-surface border border-border p-3">
      <div className="flex items-center gap-1.5 mb-1 text-text-muted">
        <Icon className="w-3 h-3" />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className={`font-semibold text-text ${small ? "text-[12px]" : "text-[18px]"}`}>{value}</div>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-16">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function TabButton({ active, onClick, label, badge }: { active: boolean; onClick: () => void; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5 ${
        active ? "bg-text text-background shadow-sm" : "text-text-muted hover:text-text"
      }`}
    >
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`text-[10px] px-1.5 rounded-full ${active ? "bg-background/20" : "bg-surface"}`}>{badge}</span>
      )}
    </button>
  );
}

function FilterChip({ active, onClick, label, platform, small }: { active: boolean; onClick: () => void; label: string; platform?: SocialBrandPlatform; small?: boolean }) {
  const meta = platform ? PLATFORM_META[platform] : null;
  const Icon = meta?.icon;
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 ${small ? "h-7 px-2.5 text-[11px]" : "h-8 px-3 text-[12px]"} rounded-full font-medium border transition-colors ${
        active ? "bg-text text-background border-text" : "bg-surface border-border text-text-secondary hover:text-text"
      }`}
    >
      {Icon && <Icon className="w-3 h-3" style={{ color: active ? undefined : meta?.color }} />}
      <span>{label}</span>
    </button>
  );
}

function TargetCard({
  target, postCount, syncing, onSync, onEdit, onRemove, onViewFeed,
}: {
  target: TargetWithProfile;
  postCount: number;
  syncing: boolean;
  onSync: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onViewFeed: () => void;
}) {
  const meta = PLATFORM_META[target.platform];
  const Icon = meta.icon;
  const profile = target.profile ?? {};
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        {profile.profile_picture_url ? (
          <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 relative bg-surface-light">
            <Image src={profile.profile_picture_url} alt="" fill sizes="48px" className="object-cover" unoptimized />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-surface-light flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-text-muted" style={{ color: meta.color }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-semibold text-text">{target.label}</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-light text-text-muted">{meta.label}</span>
            {target.last_sync_status === "error" && <span title={target.last_sync_error ?? ""}><AlertCircle className="w-3.5 h-3.5 text-danger" /></span>}
            {target.last_sync_status === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
          </div>
          <div className="text-[12px] text-text-muted">
            @{target.identifier}
            {profile.followers_count ? ` · ${formatCompact(profile.followers_count)} seguidores` : ""}
            {profile.media_count ? ` · ${profile.media_count} posts` : ""}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {postCount} coletados ·{" "}
            {target.mode === "archive_posts" ? "arquivando mídia" : "só metadado"} ·{" "}
            {target.last_synced_at ? `sync ${relativeDate(target.last_synced_at)}` : "nunca sincronizado"}
          </div>
          {target.last_sync_error && (
            <div className="text-[11px] text-danger mt-1 line-clamp-2">⚠ {target.last_sync_error}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
        <button onClick={onSync} disabled={syncing} className="flex-1 h-8 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-white text-[12px] font-medium disabled:opacity-60">
          <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sync..." : "Sync"}
        </button>
        <button onClick={onViewFeed} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-surface-light hover:bg-background text-[12px] font-medium">
          <Database className="w-3 h-3" /> Posts
        </button>
        <button onClick={onEdit} className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-surface-light hover:bg-background">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onRemove} className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-surface-light hover:bg-danger/20 text-text-muted hover:text-danger">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function PostCard({ post, onClick }: { post: FeedItem; onClick: () => void }) {
  const meta = PLATFORM_META[post.platform as SocialBrandPlatform];
  const Icon = meta?.icon ?? Camera;
  const cover = post.archive[0]?.public_url ?? post.media[0]?.thumbnail_url ?? post.media[0]?.url;
  const isVideo = (post.archive[0]?.mime_type ?? "").startsWith("video") || post.media[0]?.type === "video";
  const mediaCount = post.archive.length || post.media.length;

  return (
    <article className="rounded-xl border border-border bg-surface overflow-hidden hover:border-text-muted transition-colors cursor-pointer flex flex-col" onClick={onClick}>
      {cover ? (
        <div className="relative aspect-square bg-surface-light">
          {isVideo && post.archive[0]?.mime_type?.startsWith("video") ? (
            <video src={post.archive[0].public_url} className="w-full h-full object-cover" muted playsInline />
          ) : (
            <Image src={cover} alt="" fill sizes="(max-width:640px) 100vw, 50vw" className="object-cover" unoptimized />
          )}
          {mediaCount > 1 && (
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium inline-flex items-center gap-1">
              <ImageIcon className="w-2.5 h-2.5" /> {mediaCount}
            </div>
          )}
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px] uppercase tracking-wider font-medium">
            {post.kind}
          </div>
        </div>
      ) : (
        <div className="aspect-square bg-surface-light flex items-center justify-center">
          <Icon className="w-8 h-8 text-text-muted" />
        </div>
      )}
      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 mb-1.5 text-[11px]">
          <span className="font-semibold text-text truncate">{post.social_brand_targets?.label}</span>
          {post.posted_at && <span className="text-text-muted shrink-0">{relativeDate(post.posted_at)}</span>}
        </div>
        {post.caption && <p className="text-[12px] text-text-secondary line-clamp-3 whitespace-pre-wrap flex-1">{post.caption}</p>}
        <div className="flex items-center gap-3 mt-2 text-[11px] text-text-muted">
          {post.metrics.likes !== undefined && (<span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" /> {formatCompact(post.metrics.likes)}</span>)}
          {post.metrics.comments !== undefined && (<span className="inline-flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {formatCompact(post.metrics.comments)}</span>)}
          {post.metrics.impressions_lower !== undefined && (<span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" /> {formatCompact(post.metrics.impressions_lower)}+</span>)}
          {post.permalink && (<a href={post.permalink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="ml-auto inline-flex items-center gap-1 hover:text-primary"><ExternalLink className="w-3 h-3" /></a>)}
        </div>
      </div>
    </article>
  );
}

function Lightbox({ state, onClose, onNav }: { state: { post: FeedItem; index: number }; onClose: () => void; onNav: (i: number) => void }) {
  const { post, index } = state;
  const sources = post.archive.length > 0
    ? post.archive.map((a) => ({ url: a.public_url, type: a.mime_type.startsWith("video") ? "video" : "image" }))
    : post.media.map((m) => ({ url: m.url, type: m.type }));
  const current = sources[index];
  if (!current) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center"><X className="w-5 h-5" /></button>
      {sources.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); onNav((index - 1 + sources.length) % sources.length); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></button>
          <button onClick={(e) => { e.stopPropagation(); onNav((index + 1) % sources.length); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
        </>
      )}
      <div className="max-w-4xl max-h-[90vh] w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        {current.type === "video" ? (
          <video src={current.url} controls autoPlay className="max-h-[75vh] max-w-full rounded-lg" />
        ) : (
          <Image src={current.url} alt="" width={1200} height={1200} className="max-h-[75vh] max-w-full w-auto h-auto object-contain rounded-lg" unoptimized />
        )}
        <div className="mt-4 max-w-2xl text-center">
          <div className="text-white font-semibold mb-1">{post.social_brand_targets?.label}</div>
          {post.caption && <p className="text-white/70 text-[13px] whitespace-pre-wrap line-clamp-6">{post.caption}</p>}
          {post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12px] text-white/70 hover:text-white"><ExternalLink className="w-3 h-3" /> abrir original</a>}
        </div>
      </div>
    </div>
  );
}

function BriefingView({ briefings, onGenerate, loading }: { briefings: Briefing[]; onGenerate: () => void; loading: boolean }) {
  const latest = briefings[0];
  return (
    <div>
      <button
        onClick={onGenerate}
        disabled={loading}
        className="mb-5 h-9 px-4 inline-flex items-center gap-2 rounded-full bg-primary text-white text-[13px] font-medium hover:bg-primary-hover disabled:opacity-60"
      >
        <FileText className="w-3.5 h-3.5" />
        {loading ? "Gerando..." : "Gerar briefing agora"}
      </button>
      {!latest ? (
        <EmptyState title="Nenhum briefing ainda" hint='Adicione marcas, sincronize, e gere o primeiro briefing executivo.' />
      ) : (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3 mb-4 text-[12px] text-text-muted flex-wrap">
            <span className="text-[14px] font-semibold text-text">{latest.date}</span>
            <span>·</span>
            <span>{latest.posts_count} posts</span>
            <span>·</span>
            <span>{latest.ads_count} ads</span>
            <span>·</span>
            <span>{latest.targets_count} marcas</span>
          </div>
          <SimpleMarkdown content={latest.summary} />
          {latest.highlights.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border">
              <div className="text-[11px] uppercase tracking-wider text-text-muted mb-2">Destaques</div>
              <div className="flex flex-col gap-2">
                {latest.highlights.slice(0, 12).map((h, i) => (
                  <div key={i} className="text-[12px] text-text-secondary">
                    <span className="font-medium text-text">{h.brand}</span>
                    <span className="text-text-muted"> · {h.platform}/{h.kind}</span>
                    {h.caption_excerpt && <span> — {h.caption_excerpt}</span>}
                    {h.permalink && (<a href={h.permalink} target="_blank" rel="noreferrer" className="ml-2 text-primary inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /></a>)}
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

function SimpleMarkdown({ content }: { content: string }) {
  // bullets and bold — light-touch
  const html = content
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/^-\s+(.+)$/gm, "<li>$1</li>")
    .replace(/((?:<li>[\s\S]*?<\/li>(?:\n|$))+)/g, (m) => `<ul class="list-disc pl-5 my-2 space-y-1">${m}</ul>`);
  return <div className="text-text text-[14px] leading-relaxed [&_strong]:text-text" dangerouslySetInnerHTML={{ __html: html }} />;
}

function EmptyState({ title, hint, cta }: { title: string; hint: string; cta?: () => void }) {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
        <Megaphone className="w-6 h-6 text-text-muted" />
      </div>
      <p className="text-text-secondary text-[17px] font-medium mb-1">{title}</p>
      <p className="text-text-muted text-[14px]">{hint}</p>
      {cta && (<button onClick={cta} className="mt-4 h-9 px-4 rounded-full bg-primary text-white text-[13px] font-medium">Adicionar marca</button>)}
    </div>
  );
}

// ─── modals ─────────────────────────────────────────────────────────────────
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
  const [trackMode, setTrackMode] = useState<SocialBrandMode>("archive_posts");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<NicheSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function add(t: { platform: SocialBrandPlatform; identifier: string; label: string; niche?: string }) {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/social-brand/targets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...t, mode: trackMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      return true;
    } catch (e) { setError(String(e)); return false; }
    finally { setBusy(false); }
  }

  async function handleManual() {
    if (!identifier.trim() || !label.trim()) { setError("Preencha identifier e label."); return; }
    if (await add({ platform, identifier: identifier.trim().replace(/^@/, ""), label: label.trim(), niche: niche.trim() || undefined })) onAdded();
  }

  async function handleSuggest() {
    if (!niche.trim()) { setError("Informe um nicho."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/social-brand/suggest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: niche.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setSuggestions(data.suggestions ?? []);
      if ((data.suggestions ?? []).length === 0) setError("Nenhuma marca encontrada pra esse nicho.");
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  async function applySuggestion(s: NicheSuggestion) {
    let added = 0;
    if (s.instagram_handle) if (await add({ platform: "instagram", identifier: s.instagram_handle, label: s.label, niche })) added++;
    if (s.facebook_page) if (await add({ platform: "facebook_page", identifier: s.facebook_page, label: s.label, niche })) added++;
    if (s.ad_library_query) if (await add({ platform: "meta_ads", identifier: s.ad_library_query, label: s.label, niche })) added++;
    if (added > 0) onAdded();
  }

  return (
    <ModalShell title="Adicionar marca" onClose={onClose}>
      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-border mb-4">
        <TabButton active={mode === "manual"} onClick={() => setMode("manual")} label="Manual" />
        <TabButton active={mode === "suggest"} onClick={() => setMode("suggest")} label="Sugerir do nicho" />
      </div>

      <Field label="Modo de tracking">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-border w-full">
          <button onClick={() => setTrackMode("archive_posts")} className={`flex-1 h-8 rounded-full text-[12px] font-medium ${trackMode === "archive_posts" ? "bg-text text-background" : "text-text-muted"}`}>Arquivar posts</button>
          <button onClick={() => setTrackMode("news_only")} className={`flex-1 h-8 rounded-full text-[12px] font-medium ${trackMode === "news_only" ? "bg-text text-background" : "text-text-muted"}`}>Só novidades</button>
        </div>
        <p className="text-[11px] text-text-muted mt-1">
          {trackMode === "archive_posts" ? "Baixa imagens/vídeos pro storage. Mantém histórico permanente." : "Salva só metadado e caption. Sem download de mídia."}
        </p>
      </Field>

      {mode === "manual" ? (
        <>
          <Field label="Plataforma">
            <select value={platform} onChange={(e) => setPlatform(e.target.value as SocialBrandPlatform)} className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px]">
              <option value="instagram">Instagram (Business/Creator pública) ✓</option>
              <option value="facebook_page">Facebook Page (requer review do app)</option>
              <option value="meta_ads">Meta Ad Library (requer verificação de identidade)</option>
            </select>
            {platform === "facebook_page" && <p className="text-[11px] text-warning mt-1">⚠ App precisa de &quot;Page Public Content Access&quot; aprovado pela Meta.</p>}
            {platform === "meta_ads" && <p className="text-[11px] text-warning mt-1">⚠ Confirme identidade em facebook.com/ads/library/api antes de usar.</p>}
          </Field>
          <Field label={platform === "meta_ads" ? "Termo de busca ou page:<id>" : "Username / page slug"}>
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={platform === "instagram" ? "nubank, xpinvestimentos..." : platform === "facebook_page" ? "nubank" : "nubank  ou  page:1234567890"} className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px]" />
          </Field>
          <Field label="Label (como vai aparecer)">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nubank" className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px]" />
          </Field>
          <Field label="Nicho (opcional)">
            <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="fintech, edtech, fitness..." className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px]" />
          </Field>
          {error && <p className="text-[12px] text-danger mb-2">{error}</p>}
          <button onClick={handleManual} disabled={busy} className="w-full h-10 rounded-lg bg-primary text-white font-medium disabled:opacity-60">{busy ? "Adicionando..." : "Adicionar"}</button>
        </>
      ) : (
        <>
          <Field label="Nicho">
            <input value={niche} onChange={(e) => setNiche(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSuggest()} placeholder="ex: trading, edtech BR, fitness" className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px]" />
          </Field>
          <button onClick={handleSuggest} disabled={busy} className="w-full h-10 rounded-lg bg-primary text-white font-medium disabled:opacity-60 mb-3">
            {busy ? "Buscando..." : "Sugerir marcas"}
          </button>
          {error && <p className="text-[12px] text-danger mb-2">{error}</p>}
          <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
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
    </ModalShell>
  );
}

function EditTargetModal({ target, onClose, onSaved }: { target: TargetWithProfile; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(target.label);
  const [niche, setNiche] = useState(target.niche ?? "");
  const [trackMode, setTrackMode] = useState<SocialBrandMode>(target.mode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/social-brand/targets", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id, label, niche: niche || null, mode: trackMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      onSaved();
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  return (
    <ModalShell title={`Editar ${target.label}`} onClose={onClose}>
      <div className="text-[12px] text-text-muted mb-3">{PLATFORM_META[target.platform].label} · @{target.identifier}</div>
      <Field label="Label"><input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px]" /></Field>
      <Field label="Nicho"><input value={niche} onChange={(e) => setNiche(e.target.value)} className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-[13px]" /></Field>
      <Field label="Modo de tracking">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-border w-full">
          <button onClick={() => setTrackMode("archive_posts")} className={`flex-1 h-8 rounded-full text-[12px] font-medium ${trackMode === "archive_posts" ? "bg-text text-background" : "text-text-muted"}`}>Arquivar posts</button>
          <button onClick={() => setTrackMode("news_only")} className={`flex-1 h-8 rounded-full text-[12px] font-medium ${trackMode === "news_only" ? "bg-text text-background" : "text-text-muted"}`}>Só novidades</button>
        </div>
      </Field>
      {error && <p className="text-[12px] text-danger mb-2">{error}</p>}
      <button onClick={save} disabled={busy} className="w-full h-10 rounded-lg bg-primary text-white font-medium disabled:opacity-60">{busy ? "Salvando..." : "Salvar"}</button>
    </ModalShell>
  );
}

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background border border-border rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text text-[20px] leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
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

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
