# Phase 3 — UI Redesign Design Spec

**Date:** 2026-04-12  
**Goal:** Evolve jay-news from a functional dark UI into a polished newsletter-style reading experience with light/dark theme support.

---

## 1. Approach

Evolutionary redesign — restyle existing components in place. No architectural changes. All functionality preserved. Add three new utility components (ThemeToggle, Skeleton, FeedSkeleton).

**Aesthetic reference:** Morning Brew / The Browser — generous white space, strong typographic hierarchy, linear reading flow, clear section headers.

---

## 2. Design System

### 2.1 Theme Architecture

Themes are controlled by a `.dark` or `.light` class on `<html>`. All switchable colors are CSS custom properties overridden per class. Tailwind v4 utility classes reference these vars at runtime via `@theme inline {}`.

**To prevent FOUC (flash of wrong theme):** An inline `<script>` in `layout.tsx` runs synchronously before React hydration, reading `localStorage` and applying the correct class before the browser paints.

Priority: `localStorage` value → `prefers-color-scheme` → default dark.

```html
<!-- in layout.tsx <head>, before stylesheets -->
<script dangerouslySetInnerHTML={{ __html: `
  (function(){
    var t=localStorage.getItem('jnews-theme');
    var d=window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.add(t||(d?'dark':'light'));
  })()
`}} />
```

### 2.2 globals.css Theme Structure (`src/styles/globals.css`)

The current `@theme {}` block is split into two parts:

**Part 1 — invariant tokens (static, kept in `@theme {}`):**
Primary/secondary/danger/success colors, gold, radius, fonts. Same in both themes.

**Part 2 — switchable tokens (`@theme inline {}` + CSS var overrides):**
`@theme inline` makes Tailwind generate utilities that reference CSS custom properties at runtime instead of baking values at build time — this is what enables runtime theme switching in Tailwind v4.

```css
/* Tailwind v4 — switchable tokens */
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

/* Dark theme (default) */
:root, html.dark {
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

/* Light theme */
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
```

Add smooth transition on `html`:
```css
html { transition: background-color 0.2s, color 0.2s; }
```

### 2.3 Typography Scale

```
Display  — Sora, 28px, weight 700  (masthead "JNews")
H1       — Sora, 22px, weight 700  (highlight card headline)
H2       — Sora, 16px, weight 600  (section name, article title)
Body     — Inter, 15px, weight 400 (summaries)
Label    — Inter, 12px, weight 500, uppercase, letter-spacing 0.08em (section labels)
Caption  — Inter, 12px, weight 400 (source, date metadata)
```

### 2.4 Spacing

8px base grid. Key values: 4, 8, 12, 16, 24, 32, 48px.

---

## 3. New Components

### 3.1 `src/components/ui/ThemeToggle.tsx`

Client component. Toggles `.dark` / `.light` class on `document.documentElement` and persists to `localStorage` under key `jnews-theme`.

```tsx
"use client";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    // Read resolved theme from <html> class (set by inline script)
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
    <button onClick={toggle} title="Alternar tema"
      className="w-9 h-9 flex items-center justify-center rounded-md text-text-secondary hover:text-text hover:bg-surface transition-colors">
      {theme === "dark" ? "☀" : "🌙"}
    </button>
  );
}
```

### 3.2 `src/components/ui/Skeleton.tsx`

```tsx
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-light rounded ${className ?? ""}`} />;
}
```

### 3.3 `src/components/digest/FeedSkeleton.tsx`

Composite skeleton shaped like the feed layout. Used while loading:

```tsx
import { Skeleton } from "@/components/ui/Skeleton";

export function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-6 mt-6">
      {/* Masthead */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      {/* Highlight cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-48 md:col-span-2" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32 md:col-span-3" />
      </div>
      {/* Two category sections */}
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          {[0, 1, 2].map((j) => (
            <div key={j} className="flex flex-col gap-1.5 py-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

---

## 4. Modified Components

### 4.1 `src/styles/globals.css`

- **REQUIRED:** Remove the switchable color tokens (`--color-background`, `--color-card`, `--color-card-solid`, `--color-surface`, `--color-surface-light`, `--color-border`, `--color-text`, `--color-text-secondary`, `--color-text-muted`) from `@theme {}` BEFORE adding the `@theme inline {}` block. If both exist, Tailwind v4 uses the static baked value from `@theme {}` and the `@theme inline` override is silently ignored — theme switching will not work.
- Keep fonts, radius, primary/secondary/danger/success/gold in `@theme {}`
- Add `@theme inline {}` block for switchable tokens pointing to `--jn-*` CSS vars
- Add dark/light CSS var overrides as shown in Section 2.2
- Add `html { transition: background-color 0.2s, color 0.2s; }`

### 4.2 `src/app/layout.tsx`

- Add the FOUC-prevention inline `<script>` tag inside `<head>` before the `<body>` as shown in Section 2.1.

### 4.3 `src/app/page.tsx` — Feed page

**Header (masthead):**
```tsx
<header className="flex items-center justify-between mb-2">
  <div>
    <h1 className="text-3xl font-bold font-heading">JNews</h1>
    <p className="text-sm text-text-secondary">
      {/* full date: "Domingo, 13 de abril de 2026" */}
      {new Date().toLocaleDateString("pt-BR", { weekday:"long", day:"2-digit", month:"long", year:"numeric" })}
    </p>
  </div>
  <div className="flex gap-2 items-center">
    <ThemeToggle />
    <Button variant="ghost" onClick={...} title="Configurações">⚙</Button>
    <Button onClick={handleGenerate} loading={generating}>
      {generating ? "Gerando..." : "Gerar Digest"}
    </Button>
  </div>
</header>
```

**Loading state:** Replace spinner with `<FeedSkeleton />`.

**Empty state:** Replace plain text with:
```tsx
<div className="text-center py-20">
  <div className="text-5xl mb-4">📭</div>
  <p className="text-text-secondary text-lg mb-2">Nenhum digest ainda</p>
  <p className="text-text-muted text-sm mb-6">Clique em "Gerar Digest" para criar o primeiro.</p>
</div>
```

### 4.4 `src/components/feed/DigestTabs.tsx`

- Active tab border: `border-b-2` → `border-b-[3px]`
- Active/inactive font: `font-medium` → `font-semibold`
- Inactive text: `text-text-secondary` → `text-text-muted`
- "+ Novo" button: add `hover:text-primary` transition

### 4.5 `src/components/digest/DigestDateSelector.tsx`

Replace `<Button>` chips with pill `<button>` elements:

```tsx
<button
  key={digest.id}
  onClick={() => onSelect(digest.id)}
  className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-all ${
    digest.id === selectedId
      ? "bg-primary text-white font-semibold"
      : "bg-surface text-text-secondary border border-border hover:border-primary/40 hover:text-text"
  }`}
>
  {new Date(digest.generated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
</button>
```

### 4.6 `src/components/digest/DaySummary.tsx`

Remove `<Card>` wrapper — plain text block with border separator:

```tsx
<div className="py-6 border-b border-border">
  <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
    Resumo do dia
  </p>
  <p className="text-text leading-relaxed text-[15px]">{summary}</p>
</div>
```

### 4.7 `src/components/digest/HighlightCards.tsx`

- Main card image height: `h-40` → `h-48`
- Secondary card image height: `h-40` → `h-32`
- Main card title: add `text-lg font-bold leading-snug`
- Main card summary: `line-clamp-2` → `line-clamp-3`
- Card hover: add `hover:shadow-lg hover:shadow-black/10` alongside existing `hover:border-primary/40`
- No-image fallback: `<div className="w-full h-48 mb-3 rounded bg-surface-light flex items-center justify-center text-text-muted text-xs">{article.source_name}</div>`

### 4.8 `src/components/digest/CategorySection.tsx`

Install `lucide-react` (`npm install lucide-react`) and use `ChevronDown`.

```tsx
import { ChevronDown } from "lucide-react";

// Section header:
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
  <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
</button>
```

### 4.9 `src/components/digest/ArticleRow.tsx`

```tsx
<a
  href={article.source_url}
  target="_blank"
  rel="noopener noreferrer"
  className="flex flex-col gap-1.5 py-3 border-b border-border/40 last:border-0 hover:bg-surface/50 transition-colors px-1 -mx-1 rounded"
>
  <span className="text-[15px] font-medium text-text leading-snug">{article.title}</span>
  <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">{article.summary}</p>
  <div className="flex items-center gap-2 mt-0.5">
    <Badge>{article.source_name}</Badge>
    {article.published_at && (
      <span className="text-xs text-text-muted">
        {new Date(article.published_at).toLocaleDateString("pt-BR")}
      </span>
    )}
  </div>
</a>
```

### 4.10 `src/components/digest/AlertsSection.tsx`

```tsx
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
```

---

## 5. Files Affected

| File | Change |
|------|--------|
| `src/styles/globals.css` | Split theme tokens, add `@theme inline`, light/dark vars |
| `src/app/layout.tsx` | Add FOUC-prevention inline `<script>` |
| `src/app/page.tsx` | Masthead header, ThemeToggle, FeedSkeleton, empty state |
| `src/components/ui/ThemeToggle.tsx` | **New** |
| `src/components/ui/Skeleton.tsx` | **New** |
| `src/components/digest/FeedSkeleton.tsx` | **New** |
| `src/components/feed/DigestTabs.tsx` | Border weight, font, color polish |
| `src/components/digest/DigestDateSelector.tsx` | Pill chips replace Button |
| `src/components/digest/DaySummary.tsx` | Lead text style, remove Card |
| `src/components/digest/HighlightCards.tsx` | Bigger images, hover shadow, fallback |
| `src/components/digest/CategorySection.tsx` | Accent bar, ChevronDown, small caps |
| `src/components/digest/ArticleRow.tsx` | Border separators, cleaner typography |
| `src/components/digest/AlertsSection.tsx` | Label treatment, remove Card |
| `package.json` | Add `lucide-react` |

---

## 6. Out of Scope

- Settings page and Wizard page (functional, low daily exposure)
- No animation library (CSS transitions only)
- No responsive mobile-specific overrides beyond existing Tailwind breakpoints
