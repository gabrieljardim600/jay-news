"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Newspaper, TrendingUp, BarChart3, Search, CandlestickChart, Users, Palette } from "lucide-react";

type Mode = {
  key: "news" | "trends" | "markets" | "trading" | "social" | "brands" | "query";
  label: string;
  href: string;
  icon: typeof Newspaper;
};

const MODES: Mode[] = [
  { key: "news", label: "News", href: "/", icon: Newspaper },
  { key: "trends", label: "Trends", href: "/trends", icon: TrendingUp },
  { key: "markets", label: "Markets", href: "/markets", icon: BarChart3 },
  { key: "trading", label: "Trading", href: "/trading", icon: CandlestickChart },
  { key: "social", label: "Social", href: "/social", icon: Users },
  { key: "brands", label: "Brands", href: "/brands", icon: Palette },
  { key: "query", label: "Consulta", href: "/query", icon: Search },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function ModeNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  // Prefetch the other two routes so switching is instant.
  useEffect(() => {
    for (const m of MODES) if (!isActive(pathname, m.href)) router.prefetch(m.href);
  }, [pathname, router]);

  return (
    <nav
      aria-label="Modo de visualização"
      className="inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-border"
    >
      {MODES.map((m) => {
        const active = isActive(pathname, m.href);
        const Icon = m.icon;
        return (
          <Link
            key={m.key}
            href={m.href}
            prefetch
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium transition-all duration-200 ${
              active
                ? "bg-text text-background shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{m.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
