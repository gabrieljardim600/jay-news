# Phase 3 — UI Redesign Design Spec

**Date:** 2026-04-12  
**Goal:** Evolve jay-news from a functional dark UI into a polished newsletter-style reading experience with light/dark theme support.

---

## 1. Approach

Evolutionary redesign — restyle existing components in place. No architectural changes. All functionality preserved. Add two new utility components (ThemeToggle, Skeleton).

**Aesthetic reference:** Morning Brew / The Browser — generous white space, strong typographic hierarchy, linear reading flow, clear section headers.

---

## 2. Design System

### 2.1 Theme Architecture

Themes are controlled by a `.dark` class on `<html>` (dark is default). All colors are CSS custom properties defined in `globals.css`. Theme persists via `localStorage` key `jnews-theme`. On first load, respects `prefers-color-scheme`.

```css
/* Dark theme (default — .dark class on <html>) */
--color-background: #151515;
--color-card: rgba(28, 29, 30, 0.8);
--color-card-solid: #1c1d1e;
--color-surface: #1d1d1d;
--color-surface-light: #282828;
--color-border: #333333;
--color-text: #ffffff;
--color-text-secondary: #828282;
--color-text-muted: #4f4f4f;

/* Light theme (.light class on <html>) */
--color-background: #f8f7f4;
--color-card: #ffffff;
--color-card-solid: #ffffff;
--color-surface: #f1f0ed;
--color-surface-light: #e8e7e4;
--color-border: #e0deda;
--color-text: #111111;
--color-text-secondary: #555555;
--color-text-muted: #999999;

/* Invariant — same in both themes */
--color-primary: #fb830e;
--color-primary-hover: #fba24b;
--color-secondary: #08a6ff;
--color-secondary-hover: #6ac9ff;
--color-danger: #f54336;
--color-success: #75f94c;
```

### 2.2 Typography Scale

```
Display  — Sora, 28px, weight 700  (masthead "JNews")
H1       — Sora, 22px, weight 700  (highlight headline)
H2       — Sora, 16px, weight 600  (section name, article title)
Body     — Inter, 15px, weight 400 (summaries)
Label    — Inter, 12px, weight 500, uppercase, letter-spacing 0.08em (section labels)
Caption  — Inter, 12px, weight 400 (source, date metadata)
```

### 2.3 Spacing

8px base grid. Key values: 4, 8, 12, 16, 24, 32, 48px.

---

## 3. New Components

### 3.1 `src/components/ui/ThemeToggle.tsx`

Button that toggles `.dark` / `.light` on `<html>` and persists to `localStorage`.

- Icon: sun (☀) in dark mode, moon (🌙) in light mode
- Size: 36×36px, `variant="ghost"`, rounded
- Reads initial theme from `localStorage` or `prefers-color-scheme`
- Exported as a client component with `"use client"`

### 3.2 `src/components/ui/Skeleton.tsx`

Animated loading placeholder. Used to replace the full-page spinner.

```tsx
// Props
interface SkeletonProps {
  className?: string;
}
```

- Base: `animate-pulse bg-surface-light rounded`
- Used as building blocks: `<Skeleton className="h-6 w-48" />` etc.
- No logic — pure presentational

### 3.3 `src/components/digest/FeedSkeleton.tsx`

Composite skeleton that matches the feed layout shape:
- One line for masthead
- Three highlight card placeholders
- Two section placeholders with 3 article rows each

---

## 4. Modified Components

### 4.1 `src/app/globals.css`

- Add light theme CSS vars under `.light` selector
- Add dark theme vars under `.dark` selector (currently they're in `:root`)
- Add `html { transition: background-color 0.2s, color 0.2s; }` for smooth theme switch

### 4.2 `src/app/page.tsx` — Feed page

**Header (masthead):**
```
JNews          [☀/🌙]  [⚙]  [Gerar Digest]
Domingo, 13 de abril de 2026
```
- "JNews" in `font-heading text-3xl font-bold`
- Date line: `text-sm text-text-secondary`, formatted as `EEEE, dd de MMMM de yyyy` in pt-BR
- ThemeToggle added between logo and action buttons
- Remove current `<p>` date from inside the logo block; promote to dedicated line below title

**Loading state:** Replace `<span className="h-8 w-8 animate-spin ...">` with `<FeedSkeleton />`

**Empty state:** Add icon `📭` at 48px, improve copy.

### 4.3 `src/components/feed/DigestTabs.tsx`

- Active tab: keep color underline but increase bottom border to `border-b-[3px]`
- Tab font: `text-sm font-medium` → `text-sm font-semibold`
- Active tab text: use config color (already done) — keep
- Inactive tab: `text-text-muted` (was `text-text-secondary`)
- "+ Novo" button: keep position, style as `text-text-muted hover:text-primary`

### 4.4 `src/components/digest/DigestDateSelector.tsx`

Replace Button-based chips with custom pill chips:

```tsx
// Each chip:
<button className={`
  px-3 py-1 rounded-full text-sm whitespace-nowrap transition-all
  ${isSelected
    ? "bg-primary text-white font-semibold"
    : "bg-surface text-text-secondary border border-border hover:border-primary/40 hover:text-text"
  }
`}>
```

- No more Button component dependency here
- Selected: orange pill with white text
- Unselected: surface background with border

### 4.5 `src/components/digest/DaySummary.tsx`

Newsletter "lead" style — no card border, spacious text block:

```tsx
<div className="py-6 border-b border-border">
  <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
    Resumo do dia
  </p>
  <p className="text-text leading-relaxed text-[15px]">{summary}</p>
</div>
```

- Remove `<Card>` wrapper and gradient background
- Add `border-b` separator instead
- "Resumo do dia" label: small caps in primary color (newsletter section label style)

### 4.6 `src/components/digest/HighlightCards.tsx`

Visual improvements to the existing grid:

- Card image height: `h-40` → `h-48` (main card), `h-32` (secondary cards)
- Main card title: `font-semibold` → `text-lg font-bold` (more presence)
- Add `leading-snug` to title
- Summary: `line-clamp-2` → `line-clamp-3` for main card, `line-clamp-2` for secondary
- Card hover: `hover:border-primary/40` → `hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5`
- Fallback when no image: show source name initials in a `bg-surface-light` placeholder block

### 4.7 `src/components/digest/CategorySection.tsx`

Newsletter section header style:

```tsx
// Section header button:
<button className="flex items-center justify-between w-full text-left py-3 border-b border-border group">
  <div className="flex items-center gap-3">
    <div className="w-1 h-5 bg-primary rounded-full" />  {/* accent bar */}
    <span className="text-xs font-semibold uppercase tracking-widest text-text-secondary group-hover:text-text transition-colors">
      {name}
    </span>
    <span className="text-xs text-text-muted bg-surface px-1.5 py-0.5 rounded">
      {articles.length}
    </span>
  </div>
  <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
</button>
```

- Uses `lucide-react` `ChevronDown` icon (already installed in Next.js projects — check first, add if missing)
- Vertical orange accent bar on the left
- Name in small caps / label style
- Article count in muted pill
- Chevron rotates when open/closed (CSS transform)
- Replace text "Fechar/Abrir" with icon

### 4.8 `src/components/digest/ArticleRow.tsx`

Cleaner newsletter list item:

```tsx
<a className="flex flex-col gap-1.5 py-3 border-b border-border/40 last:border-0 hover:bg-surface/50 transition-colors px-1 -mx-1 rounded">
  <span className="text-[15px] font-medium text-text leading-snug">{article.title}</span>
  <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">{article.summary}</p>
  <div className="flex items-center gap-2">
    <Badge>{article.source_name}</Badge>
    {article.published_at && (
      <span className="text-xs text-text-muted">
        {new Date(article.published_at).toLocaleDateString("pt-BR")}
      </span>
    )}
  </div>
</a>
```

- `border-b border-border/40` separator between articles, `last:border-0` removes last one
- Remove card-style hover block; use subtle `hover:bg-surface/50` instead
- Slightly larger title text (`text-[15px]`) for readability
- `leading-snug` on title, `leading-relaxed` on summary

### 4.9 `src/components/digest/AlertsSection.tsx`

Keep the `border-l-4 border-l-primary` card style (it works well).

- Change title: `"Alertas"` → `"⚡ Alertas"` with label treatment matching CategorySection
- Remove `<Card>` wrapper; use `div` with `border-l-4 border-l-primary pl-4 py-2`

---

## 5. Files Affected

| File | Change |
|------|--------|
| `src/app/globals.css` | Add `.light` theme vars, smooth transition |
| `src/app/page.tsx` | Masthead header, FeedSkeleton, ThemeToggle |
| `src/components/ui/ThemeToggle.tsx` | **New** |
| `src/components/ui/Skeleton.tsx` | **New** |
| `src/components/digest/FeedSkeleton.tsx` | **New** |
| `src/components/feed/DigestTabs.tsx` | Minor style polish |
| `src/components/digest/DigestDateSelector.tsx` | Pill chips |
| `src/components/digest/DaySummary.tsx` | Lead text style, no card |
| `src/components/digest/HighlightCards.tsx` | Bigger images, better hover |
| `src/components/digest/CategorySection.tsx` | Accent bar, chevron, small caps |
| `src/components/digest/ArticleRow.tsx` | Border separators, cleaner type |
| `src/components/digest/AlertsSection.tsx` | Label treatment, no Card |

---

## 6. Dependencies

- `lucide-react` — check if installed; add if not (`npm install lucide-react`). Used for `ChevronDown` in CategorySection.

---

## 7. Out of Scope

- Settings page and Wizard page are not redesigned in this phase (functional, low daily exposure)
- No animation library (CSS transitions only)
- No light mode for wizard/settings (they inherit but no bespoke light styles)
- No responsive mobile-specific overrides beyond what Tailwind breakpoints already provide
