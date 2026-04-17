"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Palette, Globe, Loader2, Plus } from "lucide-react";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";

type BrandSummary = {
  id: string;
  root_url: string;
  domain: string;
  status: string;
  intent: string | null;
  title: string | null;
  favicon_url: string | null;
  total_assets: number;
  total_colors: number;
  design_system: {
    brand?: { name?: string };
    colors?: {
      primary?: { hex: string };
      secondary?: { hex: string };
      accent?: { hex: string };
    };
  } | null;
  created_at: string;
  finished_at: string | null;
};

export default function BrandsPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      const res = await fetch("/api/brands");
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setBrands(Array.isArray(data) ? data : []);
      }
      setLoading(false);
      timer = setTimeout(tick, 5000);
    }
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const newButton = (
    <Button
      onClick={() => router.push("/brands/new")}
      className="ml-1 rounded-full h-9 px-4 gap-1.5 text-[13px]"
    >
      <Plus className="w-3.5 h-3.5" /> Novo
    </Button>
  );

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8 pb-20">
      <AppHeader rightSlot={newButton} />

      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Brand scraper
        </p>
        <p className="text-[13px] text-text-secondary mt-0.5">
          Extraia design system de qualquer site — cores, logos, ícones, imagens e tipografia.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
        </div>
      ) : brands.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
            <Palette className="w-6 h-6 text-text-muted" />
          </div>
          <p className="text-text-secondary text-[17px] font-medium mb-1">Nenhum brand ainda</p>
          <p className="text-text-muted text-[14px] mb-6">
            Comece scrapeando o design system de qualquer site.
          </p>
          <Button onClick={() => router.push("/brands/new")} className="rounded-full px-6">
            Criar primeiro brand
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {brands.map((b) => (
            <BrandCard key={b.id} brand={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function BrandCard({ brand }: { brand: BrandSummary }) {
  const name = brand.design_system?.brand?.name ?? brand.title ?? brand.domain;
  const colors = brand.design_system?.colors;
  const isPending = ["pending", "crawling", "scraping", "enriching"].includes(brand.status);

  return (
    <Link
      href={`/brands/${brand.id}`}
      prefetch
      className="group text-left p-4 rounded-[14px] bg-surface border border-border hover:border-primary/50 hover:bg-surface-light transition-all active:scale-[0.99]"
    >
      <div className="flex items-start gap-3 mb-3">
        {brand.favicon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.favicon_url}
            alt=""
            className="w-10 h-10 rounded-[10px] object-contain bg-background p-1"
          />
        ) : (
          <div className="w-10 h-10 rounded-[10px] bg-background flex items-center justify-center">
            <Globe className="w-4 h-4 text-text-muted" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold truncate">{name}</p>
          <p className="text-[12px] text-text-muted truncate">{brand.domain}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {colors?.primary && <ColorDot hex={colors.primary.hex} />}
          {colors?.secondary && <ColorDot hex={colors.secondary.hex} />}
          {colors?.accent && <ColorDot hex={colors.accent.hex} />}
          {!colors?.primary && !colors?.secondary && !colors?.accent && (
            <span className="text-[11px] text-text-muted">Sem paleta</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          {isPending ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> {brand.status}
            </>
          ) : brand.status === "failed" ? (
            <span className="text-danger">falhou</span>
          ) : (
            <span>
              {brand.total_assets} assets · {brand.total_colors} cores
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ColorDot({ hex }: { hex: string }) {
  return (
    <span
      className="w-5 h-5 rounded-full border border-border"
      style={{ backgroundColor: hex }}
      title={hex}
    />
  );
}
