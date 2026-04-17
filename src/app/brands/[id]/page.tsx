"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Trash2, ExternalLink, Loader2, RotateCw, Zap } from "lucide-react";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";

type BrandAsset = {
  id: string;
  type: "logo" | "icon" | "image" | "font" | "screenshot";
  role: string | null;
  original_url: string | null;
  public_url: string;
  width: number | null;
  height: number | null;
  mime_type: string | null;
  file_size_kb: number | null;
};

type DesignSystemData = {
  brand?: { name?: string; domain?: string; tagline?: string };
  colors?: {
    primary?: { hex: string };
    secondary?: { hex: string };
    accent?: { hex: string };
    neutral?: Array<{ hex: string }>;
    background?: { hex: string };
    text?: { hex: string };
    noise?: string[];
  };
  typography?: {
    primary_font?: string;
    heading_font?: string;
    mono_font?: string;
    all_fonts?: string[];
  };
  logos?: {
    primary?: string;
    variants?: string[];
  };
  notes?: string;
};

type BrandScrape = {
  id: string;
  root_url: string;
  domain: string;
  status: string;
  intent: string | null;
  title: string | null;
  description: string | null;
  favicon_url: string | null;
  urls_scraped: string[];
  total_assets: number;
  total_colors: number;
  design_system: DesignSystemData | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
};

type Response = {
  scrape: BrandScrape;
  assets: BrandAsset[];
  htmlPreviewUrl: string | null;
};

export default function BrandDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/brands/${id}`);
      if (cancelled) return;
      if (res.ok) setData(await res.json());
      setLoading(false);
    }
    load();
    const interval = setInterval(() => {
      if (data && !["pending", "crawling", "scraping", "enriching"].includes(data.scrape.status)) return;
      load();
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, data]);

  async function handleDelete() {
    if (!confirm("Deletar este brand e todos os assets?")) return;
    const res = await fetch(`/api/brands/${id}`, { method: "DELETE" });
    if (res.ok) window.location.href = "/brands";
  }

  async function handleRefresh(engine: "light" | "deep") {
    const res = await fetch(`/api/brands/${id}/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ engine }),
    });
    const result = await res.json();
    if (res.ok) {
      window.location.href = `/brands/${result.id}`;
    } else {
      alert(result.error ?? "Erro ao re-scrapear");
    }
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  if (!data)
    return (
      <div className="min-h-screen max-w-3xl mx-auto px-5 py-8">
        <Link href="/brands" className="text-text-muted text-[13px] flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> voltar
        </Link>
        <p className="mt-8 text-text-secondary">Brand não encontrado.</p>
      </div>
    );

  const { scrape, assets, htmlPreviewUrl } = data;
  const ds = scrape.design_system;
  const byType = groupByType(assets);
  const isPending = ["pending", "crawling", "scraping", "enriching"].includes(scrape.status);

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-5 py-8 pb-20">
      <AppHeader />

      <Link
        href="/brands"
        className="inline-flex items-center gap-1 text-text-muted text-[13px] mb-4 hover:text-text"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Brands
      </Link>

      <div className="flex items-start gap-4 mb-8">
        {scrape.favicon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={scrape.favicon_url}
            alt=""
            className="w-14 h-14 rounded-[12px] object-contain bg-surface p-2 border border-border"
          />
        ) : null}
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold">{ds?.brand?.name ?? scrape.title ?? scrape.domain}</h1>
          <p className="text-[13px] text-text-muted">{scrape.domain}</p>
          {scrape.description && (
            <p className="text-[13px] text-text-secondary mt-1 line-clamp-2">{scrape.description}</p>
          )}
          {scrape.intent && (
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-background text-[11px] text-text-secondary">
              {scrape.intent}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {htmlPreviewUrl && (
            <a href={htmlPreviewUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> Preview HTML
              </Button>
            </a>
          )}
          {!isPending && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleRefresh("light")}>
                <RotateCw className="w-3.5 h-3.5 mr-1" /> Re-scrape
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleRefresh("deep")}>
                <Zap className="w-3.5 h-3.5 mr-1" /> Deep
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={handleDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {isPending && (
        <div className="mb-6 p-4 rounded-[12px] bg-surface border border-border flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <div>
            <p className="text-[14px] font-medium">Processando…</p>
            <p className="text-[12px] text-text-muted">Status: {scrape.status}</p>
          </div>
        </div>
      )}

      {scrape.status === "failed" && (
        <div className="mb-6 p-4 rounded-[12px] bg-danger/10 border border-danger/30">
          <p className="text-[14px] font-medium text-danger">Scrape falhou</p>
          {scrape.error && <p className="text-[12px] text-danger/80 mt-1">{scrape.error}</p>}
        </div>
      )}

      {ds && (
        <>
          <Section title="Design System">
            <ColorRoleGrid ds={ds} />
          </Section>

          {(ds.typography?.heading_font || ds.typography?.primary_font || ds.typography?.mono_font) && (
            <Section title="Typography">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {ds.typography?.heading_font && <FontCard label="Heading" value={ds.typography.heading_font} />}
                {ds.typography?.primary_font && <FontCard label="Body" value={ds.typography.primary_font} />}
                {ds.typography?.mono_font && <FontCard label="Mono" value={ds.typography.mono_font} />}
              </div>
            </Section>
          )}

          {ds.notes && (
            <Section title="Notes">
              <p className="text-[13px] text-text-secondary leading-relaxed">{ds.notes}</p>
            </Section>
          )}
        </>
      )}

      {byType.logo.length > 0 && (
        <Section title={`Logos (${byType.logo.length})`}>
          <AssetGrid assets={byType.logo} showPreview />
        </Section>
      )}

      {byType.icon.length > 0 && (
        <Section title={`Icons (${byType.icon.length})`}>
          <AssetGrid assets={byType.icon} showPreview />
        </Section>
      )}

      {byType.image.length > 0 && (
        <Section title={`Images (${byType.image.length})`}>
          <AssetGrid assets={byType.image} showPreview />
        </Section>
      )}

      {byType.font.length > 0 && (
        <Section title={`Fonts (${byType.font.length})`}>
          <AssetGrid assets={byType.font} showPreview={false} />
        </Section>
      )}

      {scrape.urls_scraped.length > 0 && (
        <Section title="URLs scraped">
          <ul className="text-[12px] text-text-secondary space-y-1">
            {scrape.urls_scraped.map((u) => (
              <li key={u} className="truncate">
                <a href={u} target="_blank" rel="noreferrer" className="hover:text-text">{u}</a>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-3">{title}</h2>
      {children}
    </section>
  );
}

function ColorRoleGrid({ ds }: { ds: DesignSystemData }) {
  const c = ds.colors;
  if (!c) return <p className="text-[13px] text-text-muted">Nenhuma paleta classificada.</p>;
  const roles: Array<{ label: string; hex: string | undefined }> = [
    { label: "Primary", hex: c.primary?.hex },
    { label: "Secondary", hex: c.secondary?.hex },
    { label: "Accent", hex: c.accent?.hex },
    { label: "Background", hex: c.background?.hex },
    { label: "Text", hex: c.text?.hex },
  ];
  return (
    <>
      <div className="flex flex-wrap gap-3 mb-4">
        {roles.filter((r) => r.hex).map((r) => (
          <ColorSwatch key={r.label} label={r.label} hex={r.hex!} />
        ))}
      </div>
      {c.neutral && c.neutral.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {c.neutral.map((n, i) => (
            <ColorSwatch key={i} label={`Neutral ${i + 1}`} hex={n.hex} small />
          ))}
        </div>
      )}
    </>
  );
}

function ColorSwatch({ label, hex, small }: { label: string; hex: string; small?: boolean }) {
  return (
    <div className="flex flex-col">
      <div
        className={`rounded-[8px] border border-border ${small ? "w-16 h-10" : "w-24 h-14"}`}
        style={{ backgroundColor: hex }}
      />
      <span className="text-[10px] font-medium mt-1">{label}</span>
      <span className="text-[10px] text-text-muted font-mono">{hex}</span>
    </div>
  );
}

function FontCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-[10px] bg-surface border border-border">
      <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[14px] font-medium truncate">{value}</p>
    </div>
  );
}

function AssetGrid({ assets, showPreview }: { assets: BrandAsset[]; showPreview: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {assets.map((a) => (
        <div key={a.id} className="group p-3 rounded-[10px] bg-surface border border-border">
          {showPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.public_url}
              alt=""
              className="w-full h-20 object-contain mb-2"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-20 flex items-center justify-center text-text-muted text-[11px] bg-background rounded mb-2">
              {a.mime_type?.split("/")[1] ?? "file"}
            </div>
          )}
          <div className="flex items-center justify-between text-[10px] text-text-muted">
            <span>
              {a.width && a.height ? `${a.width}×${a.height}` : a.file_size_kb ? `${a.file_size_kb}kb` : ""}
            </span>
            <a href={a.public_url} target="_blank" rel="noreferrer" download>
              <Download className="w-3 h-3 hover:text-text" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

function groupByType(assets: BrandAsset[]): Record<BrandAsset["type"], BrandAsset[]> {
  const groups: Record<BrandAsset["type"], BrandAsset[]> = {
    logo: [],
    icon: [],
    image: [],
    font: [],
    screenshot: [],
  };
  for (const a of assets) groups[a.type].push(a);
  return groups;
}
