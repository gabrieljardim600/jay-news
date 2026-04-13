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

// Wizard mode: topics not yet saved to DB
{ interests: string[] }
```

**Flow:**
1. If `digestConfigId`: load topics (name + keywords) and existing source URLs for that config from Supabase.
2. If `interests`: use the provided strings directly; treat existing sources as empty.
3. Build Claude prompt and call Claude API.
4. Parse JSON response. If parse fails or Claude errors, return `{ suggestions: [] }` — never 500.
5. Return suggestions.

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

---

### 2.2 Component — `src/components/settings/SourceSuggestions.tsx`

Client component. Reusable in both Settings and Wizard.

**Props:**
```ts
interface SourceSuggestionsProps {
  digestConfigId?: string;   // Settings mode
  interests?: string[];      // Wizard mode
  onAdd: (suggestion: { name: string; url: string; topic_name: string | null }) => void;
}
```

The `onAdd` prop emits the raw suggestion. Each integration site is responsible for converting to its own type (see sections 2.3 and 2.4).

**States:**
- **Idle:** "✨ Sugerir fontes com IA" button (ghost variant, small).
- **Loading:** button shows spinner + "Buscando sugestões...".
- **Error (network/server):** show inline `"Não foi possível buscar sugestões. Tente novamente."` in `text-danger text-xs`.
- **Empty:** show `"Nenhuma sugestão encontrada."` in `text-text-muted text-sm`.
- **Results:** render suggestions list below the button.

**Each suggestion card:**
- Source name (bold), URL (truncated, `text-xs text-text-muted`), description (`text-sm text-text-secondary`)
- `"+ Adicionar"` button → calls `onAdd(suggestion)` → removes card from list
- `"✕ Ignorar"` button → removes card from list
- When all suggestions are dismissed: hide the list (button remains to re-fetch)

**Styling:** `bg-surface`, `border border-border`, `rounded-md`, `px-3 py-2` per card.

---

### 2.3 Settings Integration — `src/components/settings/SourcesList.tsx`

Add `<SourceSuggestions digestConfigId={configId} onAdd={handleSuggestionAdd} />` below the "Fontes RSS" header row, above the sources list.

Add handler:

```ts
async function handleSuggestionAdd(suggestion: { name: string; url: string; topic_name: string | null }) {
  const res = await fetch("/api/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: suggestion.name,
      url: suggestion.url,
      topic_id: null,
      weight: 3,
      digest_config_id: configId,
    }),
  });
  if (!res.ok) {
    // Show inline error: "Não foi possível adicionar esta fonte. A URL pode ser inválida."
    // Use a local error state string rendered near the SourceSuggestions component
    return;
  }
  onRefresh();
}
```

The `POST /api/sources` route validates the URL with `isValidRssUrl`. If it returns 400, the handler must surface an inline error message — it must NOT silently fail.

---

### 2.4 Wizard Integration — `src/components/wizard/StepSources.tsx`

Add `<SourceSuggestions interests={interests} onAdd={handleSuggestionAdd} />` at the top of the step, above the interest sections.

Add handler:

```ts
function handleSuggestionAdd(suggestion: { name: string; url: string; topic_name: string | null }) {
  addSource({
    name: suggestion.name,
    url: suggestion.url,
    weight: 3,
    interest: suggestion.topic_name,
    testResult: null,  // intentionally bypasses the SourceAdder test flow
  });
}
```

`testResult: null` is valid per the `WizardSource` type (defined as `SourceTestResult | null`). The `SourceAdder` component's test-before-confirm guard applies only to manually entered URLs, not to AI suggestions. AI-suggested sources skip testing; if the URL is invalid, the user can delete the source later.

---

## 3. Trend Tracking

### 3.1 New Type — `src/types/index.ts`

Add `TrendItem` interface and update `Digest.metadata`:

```ts
export interface TrendItem {
  title: string;
  description: string;
  days_active: number;
  article_count: number;
}

export interface DigestMetadata {
  total_articles?: number;
  sources_count?: number;
  topics_count?: number;
  trends?: TrendItem[];
  error?: string;
}
```

Change `Digest.metadata` from `Record<string, unknown>` to `DigestMetadata`.

---

### 3.2 Computation — `src/lib/digest/trends.ts`

New file. Single exported function:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrendItem } from "@/types";
import Anthropic from "@anthropic-ai/sdk";

export async function computeTrends(
  digestConfigId: string,
  currentDigestId: string,
  supabase: SupabaseClient
): Promise<TrendItem[]>
```

**Flow:**
1. Query the 7 most recent **completed** digests for this `digestConfigId`, ordered by `generated_at DESC`, excluding the current digest:
   ```ts
   const { data: recentDigests } = await supabase
     .from("digests")
     .select("id, generated_at")
     .eq("digest_config_id", digestConfigId)
     .eq("status", "completed")
     .neq("id", currentDigestId)
     .order("generated_at", { ascending: false })
     .limit(7);
   ```

2. If `recentDigests` is empty or has fewer than 2 entries: return `[]` (not enough history).

3. Load all articles for those digest IDs in **one query** (avoid N+1):
   ```ts
   const digestIds = recentDigests.map((d) => d.id);
   const { data: articles } = await supabase
     .from("articles")
     .select("digest_id, title, summary")
     .in("digest_id", digestIds);
   ```

4. Group articles by `digest_id`. Build a map from `digestId → generated_at` from step 1 results.

5. If total article count < 5: return `[]`.

6. Build prompt string grouping titles by date (format: `[YYYY-MM-DD]: title1 | title2 | ...`).

7. Call Claude with the prompt (see section 3.3). Parse JSON. Return array (max 4 items).

8. If Claude fails or JSON is malformed: return `[]` — never throw.

---

### 3.3 Claude Prompt for Trends

```
Here are news articles from recent daily digests, grouped by day.
Identify 2–4 ongoing stories or recurring themes that appear across multiple days.
Each theme should represent a distinct ongoing news event (not a broad topic like "technology" or "economy").

Articles by day:
[Day 1 - YYYY-MM-DD]: title1 | title2 | title3
[Day 2 - YYYY-MM-DD]: title4 | title5
...

Return ONLY a JSON array (no explanation):
[{"title":"...","description":"...","days_active":N,"article_count":N}]
"title": short name for the story (max 6 words, in the same language as the articles)
"description": one sentence explaining what is happening (same language as articles)
"days_active": how many days this story appeared
"article_count": approximate total articles about this story across all days

If no recurring stories are found, return [].
```

---

### 3.4 Integration in Generator — `src/lib/digest/generator.ts`

`computeTrends` is called **inside `generator.ts`**, after `generateDaySummary` and before the status-update write. The trends result is merged into the single existing `metadata` update:

```ts
// After: const daySummary = await generateDaySummary(...)
const trends = await computeTrends(digestConfigId, digest.id, supabase);

await supabase.from("digests").update({
  status: "completed",
  summary: daySummary,
  metadata: {
    total_articles: processed.length,
    sources_count: new Set(processed.map((a) => a.source_name)).size,
    topics_count: new Set(processed.filter((a) => a.topic_id).map((a) => a.topic_id)).size,
    ...(trends.length > 0 ? { trends } : {}),
  } satisfies DigestMetadata,
}).eq("id", digest.id);
```

Import `computeTrends` from `@/lib/digest/trends`. Import `DigestMetadata` from `@/types`.

There is **only one** `metadata` update call for the completed status — no second update.

---

### 3.5 Feed — `GET /api/digest/[id]`

No changes needed. This route already returns the full digest record including `metadata`. With `Digest.metadata` now typed as `DigestMetadata`, the frontend reads `digest.metadata.trends` safely.

---

### 3.6 Component — `src/components/feed/TrendingSection.tsx`

**Props:**
```ts
import type { TrendItem } from "@/types";

interface TrendingSectionProps {
  trends: TrendItem[];
}
```

Renders only if `trends.length > 0`.

**Layout:**
```tsx
<div className="py-4 border-b border-border">
  <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
    📈 Em alta
  </p>
  <div className="flex flex-col">
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

### 3.7 Feed Integration — `src/app/page.tsx`

Add `<TrendingSection>` between `<DaySummary>` and `<HighlightCards>`:

```tsx
{current?.metadata?.trends && current.metadata.trends.length > 0 && (
  <TrendingSection trends={current.metadata.trends} />
)}
```

Import `TrendingSection` from `@/components/feed/TrendingSection`.

With `Digest.metadata` typed as `DigestMetadata`, `.trends` is `TrendItem[] | undefined` — no cast needed.

---

## 4. Files Affected

| File | Action | Purpose |
|------|--------|---------|
| `src/types/index.ts` | Modify | Add `TrendItem`, `DigestMetadata`; update `Digest.metadata` type |
| `src/app/api/sources/suggest/route.ts` | **Create** | Claude source suggestions endpoint |
| `src/lib/digest/trends.ts` | **Create** | `computeTrends` function |
| `src/components/settings/SourceSuggestions.tsx` | **Create** | Reusable suggestions UI component |
| `src/components/feed/TrendingSection.tsx` | **Create** | "Em alta" section in feed |
| `src/components/settings/SourcesList.tsx` | Modify | Add `SourceSuggestions` + error handling |
| `src/components/wizard/StepSources.tsx` | Modify | Add `SourceSuggestions` |
| `src/lib/digest/generator.ts` | Modify | Call `computeTrends`, merge into metadata update |
| `src/app/page.tsx` | Modify | Render `TrendingSection` |

---

## 5. Out of Scope

- Testing RSS URLs for AI-suggested sources before adding
- Caching suggestions between sessions
- User ability to dismiss/hide trends persistently
- Filtering feed articles by trending story
- Trend history visible across multiple digests (only current digest shows trends)
