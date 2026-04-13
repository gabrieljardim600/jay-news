# Phase 4 — AI Source Suggestions + Trend Tracking Design Spec

**Date:** 2026-04-13
**Status:** Approved
**Author:** Gabriel + Claude

---

## 1. Overview

Phase 4 adds two AI-powered features on top of the existing infrastructure:

1. **AI Source Suggestions** — Claude suggests new RSS feeds based on the user's topics/interests. Available on demand in Settings (sources section) and in the Wizard (sources step).
2. **Trend Tracking** — At digest generation time, Claude analyzes articles from the last 7 digests to identify recurring stories. Results are stored in `digests.metadata` and surfaced as a "Em alta" section in the feed.

No new database tables. No breaking changes to existing APIs.

---

## 2. AI Source Suggestions

### 2.1 API — `POST /api/sources/suggest`

**Auth:** Required (existing middleware).

**Request body** — one of two modes:

```ts
// Settings mode: load topics from DB
{ digestConfigId: string }

// Wizard mode: topics not in DB yet
{ interests: string[] }
```

**Flow:**
1. If `digestConfigId`: load topics (name + keywords) and existing source URLs for that config from Supabase.
2. If `interests`: use the provided strings directly; existing sources = empty.
3. Build Claude prompt and call Claude API.
4. Return suggestions JSON.

**Claude prompt:**

```
You are a news curator. The user follows these topics: [topic names + keywords].
They already have these RSS sources: [existing source URLs].
Suggest 5–8 new RSS feeds they are NOT already following.
Requirements:
- Real, actively maintained feeds
- Return the RSS/Atom feed URL directly (not the website homepage)
- Relevant to the listed topics
- Prioritize well-known, reliable sources

Return ONLY a JSON array (no explanation):
[{"name":"...","url":"...","description":"...","topic_name":"..."}]
"topic_name" should match one of the user's topics, or null if general.
```

**Response:**

```ts
{ suggestions: Array<{ name: string; url: string; description: string; topic_name: string | null }> }
```

**Error handling:** If Claude fails or returns malformed JSON, return `{ suggestions: [] }` — never 500.

---

### 2.2 Component — `src/components/settings/SourceSuggestions.tsx`

Client component. Reusable in both Settings and Wizard.

**Props:**
```ts
interface SourceSuggestionsProps {
  digestConfigId?: string;   // Settings mode
  interests?: string[];      // Wizard mode
  onAdd: (source: { name: string; url: string; topic_name: string | null }) => void;
}
```

**Behavior:**
- Renders a `"✨ Sugerir fontes com IA"` button (ghost variant, small).
- On click: sets `loading = true`, calls `POST /api/sources/suggest`, stores results in local state.
- While loading: button shows spinner + "Buscando sugestões...".
- After response: renders suggestions list inline below the button.
- Each suggestion card shows: name, URL (truncated), description, "+ Adicionar" button, "✕ Ignorar" button.
- "Adicionar" calls `onAdd(suggestion)` and removes the card from the list.
- "Ignorar" removes the card from the list.
- If all suggestions are dismissed: hide the suggestions list (button remains to re-fetch).
- Empty suggestions: show "Nenhuma sugestão encontrada."

**Styling:** consistent with existing settings components — `bg-surface`, `border border-border`, `rounded-md`, primary color accent.

---

### 2.3 Settings Integration — `src/components/settings/SourcesList.tsx`

Add `<SourceSuggestions>` below the "Fontes RSS" header row (above the sources list).

When a suggestion is accepted via `onAdd`:
1. Call `POST /api/sources` with `{ name, url, topic_id: null, weight: 3, digest_config_id: configId }`.
2. Call `onRefresh()` to reload the sources list.

Pass `digestConfigId={configId}` to SourceSuggestions.

---

### 2.4 Wizard Integration — `src/components/wizard/StepSources.tsx`

Add `<SourceSuggestions>` at the top of the step, above the interest sections.

Pass `interests={interests}` (the full interests array from step 1).

When a suggestion is accepted via `onAdd`:
- Call `onAdd({ name, url, weight: 3, interest: suggestion.topic_name, testResult: null })` using the existing `addSource` function signature.
- The source is added to the wizard's in-memory list. No RSS test required for AI-suggested sources.

---

## 3. Trend Tracking

### 3.1 Computation — `src/lib/digest/trends.ts`

New file. Single exported function:

```ts
export async function computeTrends(
  digestConfigId: string,
  supabase: SupabaseClient
): Promise<TrendItem[]>
```

**`TrendItem` type:**
```ts
interface TrendItem {
  title: string;
  description: string;
  days_active: number;
  article_count: number;
}
```

**Flow:**
1. Query the last 7 completed digests for this `digestConfigId` (ordered by `generated_at DESC`).
2. For each digest, load its articles (title + summary).
3. If total articles across all digests < 5: return `[]` (not enough data).
4. Build Claude prompt with articles grouped by day.
5. Call Claude. Parse response. Return array (max 4 items).

**Claude prompt:**

```
Here are news articles from the last 7 daily digests, grouped by day. 
Identify 2–4 ongoing stories or recurring themes that appear across multiple days.
Each theme should represent a distinct ongoing news event (not a general topic like "technology").

Articles by day:
[Day 1 - YYYY-MM-DD]: title1 | title2 | ...
[Day 2 - YYYY-MM-DD]: title3 | title4 | ...
...

Return ONLY a JSON array:
[{"title":"...","description":"...","days_active":N,"article_count":N}]
"title": short name for the story (max 6 words)
"description": one sentence explaining what's happening
"days_active": how many days this story appeared
"article_count": approximate number of articles about this story

If no recurring stories are found, return [].
```

**Error handling:** If Claude fails or returns malformed JSON, return `[]` — never throw.

---

### 3.2 Storage

Trends are stored in the `metadata` JSONB field of the `digests` table (already exists):

```json
{
  "trends": [
    { "title": "Banco Master", "description": "Negociações de aquisição pelo BTG em andamento", "days_active": 4, "article_count": 7 }
  ]
}
```

No new migration required.

---

### 3.3 Generation Integration — `src/app/api/digest/generate/route.ts`

After saving all articles and generating the day summary (current final step), add:

```ts
const trends = await computeTrends(digestConfigId, supabase);
if (trends.length > 0) {
  await supabase
    .from("digests")
    .update({ metadata: { ...existingMetadata, trends } })
    .eq("id", digestId);
}
```

Import `computeTrends` from `@/lib/digest/trends`.

---

### 3.4 Feed — `GET /api/digest/[id]`

No changes needed. This route already returns the full digest record including `metadata`. The frontend reads `digest.metadata?.trends`.

---

### 3.5 Component — `src/components/feed/TrendingSection.tsx`

**Props:**
```ts
interface TrendingSectionProps {
  trends: TrendItem[];
}
```

**Renders:** only if `trends.length > 0`.

**Layout:**
```tsx
<div className="py-4 border-b border-border">
  <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
    📈 Em alta
  </p>
  <div className="flex flex-col gap-2">
    {trends.map((trend, i) => (
      <div key={i} className="flex flex-col gap-0.5 py-2 border-b border-border/30 last:border-0">
        <span className="text-sm font-semibold text-text">{trend.title}</span>
        <p className="text-xs text-text-secondary leading-relaxed">{trend.description}</p>
        <span className="text-xs text-text-muted mt-0.5">{trend.days_active} dias · {trend.article_count} artigos</span>
      </div>
    ))}
  </div>
</div>
```

---

### 3.6 Feed Integration — `src/app/page.tsx`

Add `<TrendingSection>` between `<DaySummary>` and `<HighlightCards>`, reading from the loaded digest:

```tsx
{current?.metadata?.trends?.length > 0 && (
  <TrendingSection trends={current.metadata.trends} />
)}
```

Import `TrendingSection` from `@/components/feed/TrendingSection`.

Add `trends?: TrendItem[]` to the `metadata` field in the `Digest` type in `src/types/index.ts`.

---

## 4. Files Affected

| File | Action | Purpose |
|------|--------|---------|
| `src/app/api/sources/suggest/route.ts` | **Create** | Claude source suggestions endpoint |
| `src/lib/digest/trends.ts` | **Create** | computeTrends function |
| `src/components/settings/SourceSuggestions.tsx` | **Create** | Reusable suggestions UI component |
| `src/components/feed/TrendingSection.tsx` | **Create** | "Em alta" section in feed |
| `src/components/settings/SourcesList.tsx` | Modify | Add SourceSuggestions |
| `src/components/wizard/StepSources.tsx` | Modify | Add SourceSuggestions |
| `src/app/api/digest/generate/route.ts` | Modify | Call computeTrends after generation |
| `src/app/page.tsx` | Modify | Render TrendingSection |
| `src/types/index.ts` | Modify | Add `trends` to Digest metadata type |

---

## 5. Out of Scope

- Testing RSS URLs for AI-suggested sources (user can delete if invalid)
- Caching suggestions between sessions
- User ability to dismiss/hide trends persistently
- Trend history across multiple digests (only current digest shows trends)
- Filtering feed articles by trending story
