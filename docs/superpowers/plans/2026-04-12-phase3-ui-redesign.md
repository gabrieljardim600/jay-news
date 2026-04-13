# Phase 3 UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve jay-news into a newsletter-style reading experience with light/dark theme switching using an evolutionary component-by-component redesign.

**Architecture:** Tailwind v4 `@theme inline {}` for runtime-switchable theme tokens; a FOUC-prevention inline script in `layout.tsx`; all existing components restyled in place. Three new utility components (ThemeToggle, Skeleton, FeedSkeleton). No changes to data fetching or API routes.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, lucide-react (new), TypeScript

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add lucide-react |
| `src/styles/globals.css` | Modify | Split static/dynamic theme tokens; add light/dark CSS vars |
| `src/app/layout.tsx` | Modify | Add FOUC-prevention inline script |
| `src/components/ui/ThemeToggle.tsx` | Create | Sun/moon toggle, persists to localStorage |
| `src/components/ui/Skeleton.tsx` | Create | Animated loading placeholder |
| `src/components/digest/FeedSkeleton.tsx` | Create | Full-page loading skeleton |
| `src/app/page.tsx` | Modify | Masthead header, ThemeToggle, FeedSkeleton, better empty state |
| `src/components/feed/DigestTabs.tsx` | Modify | Thicker underline, font polish |
| `src/components/digest/DigestDateSelector.tsx` | Modify | Pill chips |
| `src/components/digest/DaySummary.tsx` | Modify | Newsletter lead text, remove Card |
| `src/components/digest/HighlightCards.tsx` | Modify | Bigger images, hover shadow, no-image fallback |
| `src/components/digest/CategorySection.tsx` | Modify | Accent bar, ChevronDown, small-caps label |
| `src/components/digest/ArticleRow.tsx` | Modify | Border separators, cleaner typography |
| `src/components/digest/AlertsSection.tsx` | Modify | Label treatment, remove Card wrapper |

---

## Task 1: Install lucide-react

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install the package**

```bash
cd C:\Users\Gabriel\Documents\GitHub\jay-news
npm install lucide-react
```

Expected: `lucide-react` appears in `package.json` dependencies. No errors.

- [ ] **Step 2: Verify TypeScript can find it**

```bash
npx tsc --noEmit 2>&1 | head -5
```

Expected: no errors about lucide-react.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add lucide-react"
```

---

## Task 2: Split globals.css for light/dark theme switching

**Files:**
- Modify: `src/styles/globals.css`

**Context:** Tailwind v4 uses `@theme {}` to bake values at build time. For runtime theme switching, switchable tokens must move to `@theme inline {}` (which generates utilities referencing CSS vars) and the actual values go in `:root`/`.dark`/`.light` selectors. **Critical:** tokens must NOT exist in both `@theme {}` and `@theme inline {}` simultaneously — the static one wins and theme switching silently fails.

- [ ] **Step 1: Replace the entire globals.css**

Write `src/styles/globals.css`:

```css
@import "tailwindcss";

/* ─── Invariant tokens — baked at build time ─────────────────────────── */
@theme {
  --color-primary: #fb830e;
  --color-primary-hover: #fba24b;
  --color-secondary: #08a6ff;
  --color-secondary-hover: #6ac9ff;
  --color-danger: #f54336;
  --color-success: #75f94c;
  --color-gold: #c0b662;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --font-heading: var(--font-heading);
  --font-body: var(--font-body);
}

/* ─── Switchable tokens — utilities reference CSS vars at runtime ─────── */
@theme inline {
  --color-background: var(--jn-bg);
  --color-card: var(--jn-card);
  --color-card-solid: var(--jn-card-solid);
  --color-surface: var(--jn-surface);
  --color-surface-light: var(--jn-surface-light);
  --color-border: var(--jn-border);
  --color-text: var(--jn-text);
  --color-text-secondary: var(--jn-text-secondary);
  --color-text-muted: var(--jn-text-muted);
}

/* ─── Dark theme (default) ────────────────────────────────────────────── */
:root,
html.dark {
  --jn-bg: #151515;
  --jn-card: rgba(28, 29, 30, 0.8);
  --jn-card-solid: #1c1d1e;
  --jn-surface: #1d1d1d;
  --jn-surface-light: #282828;
  --jn-border: #333333;
  --jn-text: #ffffff;
  --jn-text-secondary: #828282;
  --jn-text-muted: #4f4f4f;
}

/* ─── Light theme ─────────────────────────────────────────────────────── */
html.light {
  --jn-bg: #f8f7f4;
  --jn-card: #ffffff;
  --jn-card-solid: #ffffff;
  --jn-surface: #f1f0ed;
  --jn-surface-light: #e8e7e4;
  --jn-border: #e0deda;
  --jn-text: #111111;
  --jn-text-secondary: #555555;
  --jn-text-muted: #999999;
}

/* ─── Base styles ─────────────────────────────────────────────────────── */
html {
  transition: background-color 0.2s, color 0.2s;
}

body {
  background-color: var(--color-background);
  color: var(--color-text);
  font-family: var(--font-body);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
}
```

- [ ] **Step 2: Verify build still passes**

```bash
npx next build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`, no TypeScript errors, 17 routes still appear.

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: split globals.css for runtime light/dark theme switching (Tailwind v4)"
```

---

## Task 3: FOUC prevention script in layout.tsx

**Files:**
- Modify: `src/app/layout.tsx`

**Context:** React hydration happens after the first paint. Without a synchronous inline script, users on light mode will see a dark flash before React applies the correct theme class. The script runs before browser paint.

- [ ] **Step 1: Update layout.tsx**

Write `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "@/styles/globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JNews - AI News Digest",
  description: "Personalized AI-powered news digest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${inter.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('jnews-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.add(t||(d?'dark':'light'));})()`,
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add FOUC-prevention theme script to layout"
```

---

## Task 4: ThemeToggle component

**Files:**
- Create: `src/components/ui/ThemeToggle.tsx`

- [ ] **Step 1: Create ThemeToggle.tsx**

Write `src/components/ui/ThemeToggle.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(next);
    localStorage.setItem("jnews-theme", next);
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      title="Alternar tema"
      className="w-9 h-9 flex items-center justify-center rounded-md text-text-secondary hover:text-text hover:bg-surface transition-colors text-base"
    >
      {theme === "dark" ? "☀" : "🌙"}
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ThemeToggle.tsx
git commit -m "feat: add ThemeToggle component with localStorage persistence"
```

---

## Task 5: Skeleton + FeedSkeleton components

**Files:**
- Create: `src/components/ui/Skeleton.tsx`
- Create: `src/components/digest/FeedSkeleton.tsx`

- [ ] **Step 1: Create Skeleton.tsx**

Write `src/components/ui/Skeleton.tsx`:

```tsx
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-surface-light rounded ${className ?? ""}`} />
  );
}
```

- [ ] **Step 2: Create FeedSkeleton.tsx**

Write `src/components/digest/FeedSkeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/Skeleton";

export function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-6 mt-6">
      {/* Masthead */}
      <div className="flex flex-col gap-2 mb-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-52" />
      </div>

      {/* Highlight cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-48 md:col-span-2 rounded-md" />
        <Skeleton className="h-48 rounded-md" />
      </div>

      {/* Category sections */}
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-36" />
          {[0, 1, 2].map((j) => (
            <div key={j} className="flex flex-col gap-1.5 py-2 border-b border-border/20">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Skeleton.tsx src/components/digest/FeedSkeleton.tsx
git commit -m "feat: add Skeleton and FeedSkeleton loading components"
```

---

## Task 6: Feed page masthead + ThemeToggle + FeedSkeleton

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update the header section and loading/empty states in page.tsx**

The changes are in the import list and three JSX blocks. Read the current file, then apply:

**Imports to add at top:**
```tsx
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { FeedSkeleton } from "@/components/digest/FeedSkeleton";
```

**Replace the loading return block** (the `if (loading)` block):
```tsx
if (loading) {
  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
      <FeedSkeleton />
    </div>
  );
}
```

**Replace the header JSX** (the `<header>` element inside the return):
```tsx
<header className="flex items-center justify-between mb-4">
  <div>
    <h1 className="text-3xl font-bold font-heading">JNews</h1>
    <p className="text-sm text-text-secondary">
      {new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })}
    </p>
  </div>
  <div className="flex gap-2 items-center">
    <ThemeToggle />
    <Button
      variant="ghost"
      onClick={() => router.push(`/settings?configId=${activeConfigId}`)}
      title="Configurações"
    >
      ⚙
    </Button>
    <Button onClick={handleGenerate} loading={generating}>
      {generating ? "Gerando..." : "Gerar Digest"}
    </Button>
  </div>
</header>
```

**Replace the empty state block** (the `!current && digests.length === 0` block):
```tsx
{!current && digests.length === 0 && (
  <div className="text-center py-20">
    <div className="text-5xl mb-4">📭</div>
    <p className="text-text-secondary text-lg mb-2">
      {activeConfig
        ? `Nenhum digest para "${activeConfig.icon} ${activeConfig.name}" ainda`
        : "Nenhum digest gerado ainda"}
    </p>
    <p className="text-text-muted text-sm mb-6">
      Clique em &quot;Gerar Digest&quot; para criar o primeiro.
    </p>
  </div>
)}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: masthead header, ThemeToggle, FeedSkeleton, better empty state"
```

---

## Task 7: DigestTabs polish

**Files:**
- Modify: `src/components/feed/DigestTabs.tsx`

- [ ] **Step 1: Rewrite DigestTabs.tsx**

Write `src/components/feed/DigestTabs.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import type { DigestConfig } from "@/types";

interface DigestTabsProps {
  configs: DigestConfig[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function DigestTabs({ configs, activeId, onSelect }: DigestTabsProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-4 scrollbar-hide border-b border-border">
      {configs.map((config) => {
        const isActive = activeId === config.id;
        return (
          <button
            key={config.id}
            onClick={() => onSelect(config.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all border-b-[3px] -mb-px ${
              isActive
                ? "text-white border-current"
                : "text-text-muted border-transparent hover:text-text hover:border-border"
            }`}
            style={isActive ? { borderColor: config.color, color: config.color } : undefined}
          >
            <span>{config.icon}</span>
            <span>{config.name}</span>
          </button>
        );
      })}
      <button
        onClick={() => router.push("/wizard")}
        className="flex items-center px-3 py-2.5 text-sm text-text-muted hover:text-primary border-b-[3px] border-transparent -mb-px transition-all whitespace-nowrap"
        title="Novo digest"
      >
        + Novo
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/feed/DigestTabs.tsx
git commit -m "feat: DigestTabs — thicker active underline, font-semibold, hover:text-primary"
```

---

## Task 8: DigestDateSelector pill chips

**Files:**
- Modify: `src/components/digest/DigestDateSelector.tsx`

- [ ] **Step 1: Rewrite DigestDateSelector.tsx**

Write `src/components/digest/DigestDateSelector.tsx`:

```tsx
"use client";

import type { Digest } from "@/types";

interface DigestDateSelectorProps {
  digests: Digest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DigestDateSelector({ digests, selectedId, onSelect }: DigestDateSelectorProps) {
  if (digests.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
      {digests.map((digest) => {
        const isSelected = digest.id === selectedId;
        return (
          <button
            key={digest.id}
            onClick={() => onSelect(digest.id)}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-all ${
              isSelected
                ? "bg-primary text-white font-semibold"
                : "bg-surface text-text-secondary border border-border hover:border-primary/40 hover:text-text"
            }`}
          >
            {new Date(digest.generated_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/digest/DigestDateSelector.tsx
git commit -m "feat: DigestDateSelector — pill chip style"
```

---

## Task 9: DaySummary newsletter lead

**Files:**
- Modify: `src/components/digest/DaySummary.tsx`

- [ ] **Step 1: Rewrite DaySummary.tsx**

Write `src/components/digest/DaySummary.tsx`:

```tsx
interface DaySummaryProps {
  summary: string | null;
}

export function DaySummary({ summary }: DaySummaryProps) {
  if (!summary) return null;

  return (
    <div className="py-6 border-b border-border">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
        Resumo do dia
      </p>
      <p className="text-text leading-relaxed text-[15px]">{summary}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/digest/DaySummary.tsx
git commit -m "feat: DaySummary — newsletter lead text style, remove card border"
```

---

## Task 10: HighlightCards — bigger images, hover shadow, fallback

**Files:**
- Modify: `src/components/digest/HighlightCards.tsx`

- [ ] **Step 1: Rewrite HighlightCards.tsx**

Write `src/components/digest/HighlightCards.tsx`:

```tsx
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Article } from "@/types";

interface HighlightCardsProps {
  articles: Article[];
}

export function HighlightCards({ articles }: HighlightCardsProps) {
  if (!articles || articles.length === 0) return null;

  const top = articles.slice(0, 3);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {top.map((article, i) => (
        <a
          key={article.id}
          href={article.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className={i === 0 ? "md:col-span-2" : ""}
        >
          <Card className="h-full hover:border-primary/60 hover:shadow-lg hover:shadow-black/10 transition-all">
            {article.image_url ? (
              <div className={`relative w-full ${i === 0 ? "h-48" : "h-32"} mb-3 rounded overflow-hidden bg-surface`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.image_url}
                  alt={article.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className={`w-full ${i === 0 ? "h-48" : "h-32"} mb-3 rounded bg-surface-light flex items-center justify-center`}>
                <span className="text-xs text-text-muted font-medium">{article.source_name}</span>
              </div>
            )}
            <h3 className={`font-bold text-text leading-snug mb-1 ${i === 0 ? "text-lg" : "text-base"}`}>
              {article.title}
            </h3>
            <p className={`text-sm text-text-secondary mb-2 ${i === 0 ? "line-clamp-3" : "line-clamp-2"}`}>
              {article.summary}
            </p>
            <Badge>{article.source_name}</Badge>
          </Card>
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/digest/HighlightCards.tsx
git commit -m "feat: HighlightCards — larger images, shadow hover, no-image fallback"
```

---

## Task 11: CategorySection — accent bar + chevron + small-caps

**Files:**
- Modify: `src/components/digest/CategorySection.tsx`

**Note:** `lucide-react` must be installed (Task 1) before this task.

- [ ] **Step 1: Rewrite CategorySection.tsx**

Write `src/components/digest/CategorySection.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ArticleRow } from "./ArticleRow";
import type { Article } from "@/types";

interface CategorySectionProps {
  name: string;
  articles: Article[];
}

export function CategorySection({ name, articles }: CategorySectionProps) {
  const [open, setOpen] = useState(true);

  if (!articles || articles.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        className="flex items-center justify-between w-full text-left py-3 border-b border-border group"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary group-hover:text-text transition-colors">
            {name}
          </span>
          <span className="text-xs text-text-muted bg-surface px-1.5 py-0.5 rounded">
            {articles.length}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="flex flex-col">
          {articles.map((article) => (
            <ArticleRow key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/digest/CategorySection.tsx
git commit -m "feat: CategorySection — accent bar, ChevronDown icon, small-caps label"
```

---

## Task 12: ArticleRow — border separators + cleaner typography

**Files:**
- Modify: `src/components/digest/ArticleRow.tsx`

- [ ] **Step 1: Rewrite ArticleRow.tsx**

Write `src/components/digest/ArticleRow.tsx`:

```tsx
import { Badge } from "@/components/ui/Badge";
import type { Article } from "@/types";

interface ArticleRowProps {
  article: Article;
}

export function ArticleRow({ article }: ArticleRowProps) {
  return (
    <a
      href={article.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-1.5 py-3 border-b border-border/40 last:border-0 hover:bg-surface/50 transition-colors px-1 -mx-1 rounded"
    >
      <span className="text-[15px] font-medium text-text leading-snug">
        {article.title}
      </span>
      <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">
        {article.summary}
      </p>
      <div className="flex items-center gap-2 mt-0.5">
        <Badge>{article.source_name}</Badge>
        {article.published_at && (
          <span className="text-xs text-text-muted">
            {new Date(article.published_at).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>
    </a>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/digest/ArticleRow.tsx
git commit -m "feat: ArticleRow — border separators, refined typography"
```

---

## Task 13: AlertsSection — label treatment, remove Card

**Files:**
- Modify: `src/components/digest/AlertsSection.tsx`

- [ ] **Step 1: Rewrite AlertsSection.tsx**

Write `src/components/digest/AlertsSection.tsx`:

```tsx
import { ArticleRow } from "./ArticleRow";
import type { Article } from "@/types";

interface AlertsSectionProps {
  articles: Article[];
}

export function AlertsSection({ articles }: AlertsSectionProps) {
  if (!articles || articles.length === 0) return null;

  return (
    <div className="border-l-4 border-l-primary pl-4 py-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
        ⚡ Alertas
      </p>
      <div className="flex flex-col">
        {articles.map((article) => (
          <ArticleRow key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/components/digest/AlertsSection.tsx
git commit -m "feat: AlertsSection — label treatment, remove Card wrapper"
```

---

## Task 14: Final build verification + push

**Files:** None modified

- [ ] **Step 1: Full production build**

```bash
cd C:\Users\Gabriel\Documents\GitHub\jay-news
npx next build 2>&1
```

Expected output:
```
✓ Compiled successfully
✓ Generating static pages (17/17)
```

No TypeScript errors, no missing modules, all 17 routes still present.

- [ ] **Step 2: If build fails, diagnose and fix**

Common issues:
- Missing import for `ThemeToggle` or `FeedSkeleton` in `page.tsx` → add imports
- `lucide-react` not found → run `npm install lucide-react` again
- `@theme inline` token conflict → verify no duplicate `--color-*` entries exist in both `@theme {}` and `@theme inline {}`

- [ ] **Step 3: Push branch**

```bash
git push origin $(git branch --show-current)
```

- [ ] **Step 4: Confirm**

Log of last commits should show 14 new commits since Phase 2. All tasks complete.
