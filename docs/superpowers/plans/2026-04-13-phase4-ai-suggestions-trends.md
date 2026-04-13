# Phase 4 — AI Source Suggestions + Trend Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Claude-powered RSS source suggestions (on-demand, in Settings + Wizard) and automatic trend tracking (detects recurring stories across the last 7 digests, shown in the feed as "Em alta").

**Architecture:** Two independent features sharing no code. Source suggestions: new `POST /api/sources/suggest` endpoint + reusable `SourceSuggestions` component wired into Settings and Wizard. Trend tracking: `computeTrends` function called inside `generator.ts` after article save, result merged into the single `metadata` update, rendered via new `TrendingSection` in the feed. No new DB tables — trends stored in `digests.metadata` JSONB.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, Supabase, Anthropic SDK (`claude-sonnet-4-6`)

**Spec:** `docs/superpowers/specs/2026-04-13-phase4-ai-suggestions-trends-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/types/index.ts` | Modify | Add `TrendItem`, `DigestMetadata`; update `Digest.metadata` |
| `src/app/api/sources/suggest/route.ts` | **Create** | Claude source suggestions endpoint |
| `src/lib/digest/trends.ts` | **Create** | `computeTrends` — detects recurring stories |
| `src/components/settings/SourceSuggestions.tsx` | **Create** | Reusable AI suggestions UI (Settings + Wizard) |
| `src/components/feed/TrendingSection.tsx` | **Create** | "Em alta" section in feed |
| `src/components/settings/SourcesList.tsx` | Modify | Wire in `SourceSuggestions` |
| `src/components/wizard/StepSources.tsx` | Modify | Wire in `SourceSuggestions` |
| `src/lib/digest/generator.ts` | Modify | Call `computeTrends`, merge into metadata update |
| `src/app/page.tsx` | Modify | Render `TrendingSection` |

---

## Task 1: Add TrendItem and DigestMetadata types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add new interfaces and update Digest.metadata**

Open `src/types/index.ts`. Make two changes:

**1a — Add after the `ProcessedArticle` interface (before `DigestWithArticles`):**

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

**1b — Change `Digest.metadata` field from:**
```ts
metadata: Record<string, unknown>;
```
**to:**
```ts
metadata: DigestMetadata;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\Gabriel\Documents\GitHub\jay-news
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing errors unrelated to these types).

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TrendItem and DigestMetadata types"
```

---

## Task 2: POST /api/sources/suggest endpoint

**Files:**
- Create: `src/app/api/sources/suggest/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/sources/suggest/route.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { digestConfigId, interests } = body as {
    digestConfigId?: string;
    interests?: string[];
  };

  let topicDescriptions: string[] = [];
  let existingUrls: string[] = [];

  if (digestConfigId) {
    const [{ data: topics }, { data: sources }] = await Promise.all([
      supabase
        .from("topics")
        .select("name, keywords")
        .eq("digest_config_id", digestConfigId)
        .eq("is_active", true),
      supabase
        .from("rss_sources")
        .select("url")
        .eq("digest_config_id", digestConfigId)
        .eq("is_active", true),
    ]);
    topicDescriptions = (topics || []).map(
      (t) => `${t.name} (${(t.keywords as string[]).join(", ")})`
    );
    existingUrls = (sources || []).map((s) => s.url);
  } else if (interests && interests.length > 0) {
    topicDescriptions = interests;
  }

  if (topicDescriptions.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  const prompt = `You are a news curator. The user follows these topics: ${topicDescriptions.join("; ")}.
They already have these RSS sources: ${existingUrls.length > 0 ? existingUrls.join(", ") : "none"}.
Suggest 5–8 new RSS feeds they are NOT already following.
Requirements:
- Real, actively maintained feeds
- Return the RSS/Atom feed URL directly (not the website homepage)
- Relevant to the listed topics
- Prioritize well-known, reliable sources

Return ONLY a JSON array (no explanation):
[{"name":"...","url":"...","description":"...","topic_name":"..."}]
"topic_name" should match one of the user's topics, or null if general.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ suggestions: [] });

    const suggestions = JSON.parse(jsonMatch[0]) as Array<{
      name: string;
      url: string;
      description: string;
      topic_name: string | null;
    }>;
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sources/suggest/route.ts
git commit -m "feat: add POST /api/sources/suggest endpoint"
```

---

## Task 3: computeTrends function

**Files:**
- Create: `src/lib/digest/trends.ts`

**Context:** This function is called from `generator.ts` which already uses a Supabase service-role client (`SupabaseClient` from `@supabase/supabase-js`). The function receives that same client instance.

- [ ] **Step 1: Create the trends module**

Create `src/lib/digest/trends.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import type { TrendItem } from "@/types";

const anthropic = new Anthropic();

export async function computeTrends(
  digestConfigId: string,
  currentDigestId: string,
  supabase: SupabaseClient
): Promise<TrendItem[]> {
  try {
    // 1. Get last 7 completed digests for this config, excluding the current one
    const { data: recentDigests } = await supabase
      .from("digests")
      .select("id, generated_at")
      .eq("digest_config_id", digestConfigId)
      .eq("status", "completed")
      .neq("id", currentDigestId)
      .order("generated_at", { ascending: false })
      .limit(7);

    if (!recentDigests || recentDigests.length < 2) return [];

    // 2. Load all articles in one query (avoid N+1)
    const digestIds = recentDigests.map((d) => d.id as string);
    const { data: articles } = await supabase
      .from("articles")
      .select("digest_id, title")
      .in("digest_id", digestIds);

    if (!articles || articles.length < 5) return [];

    // 3. Group article titles by date
    const dateByDigest = new Map(
      recentDigests.map((d) => [
        d.id as string,
        (d.generated_at as string).slice(0, 10),
      ])
    );

    const byDate: Record<string, string[]> = {};
    for (const article of articles) {
      const date = dateByDigest.get(article.digest_id as string) ?? "unknown";
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(article.title as string);
    }

    const articlesByDay = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, titles]) => `[${date}]: ${titles.join(" | ")}`)
      .join("\n");

    // 4. Ask Claude to identify recurring stories
    const prompt = `Here are news articles from recent daily digests, grouped by day.
Identify 2–4 ongoing stories or recurring themes that appear across multiple days.
Each theme should represent a distinct ongoing news event (not a broad topic like "technology" or "economy").

Articles by day:
${articlesByDay}

Return ONLY a JSON array (no explanation):
[{"title":"...","description":"...","days_active":N,"article_count":N}]
"title": short name for the story (max 6 words, in the same language as the articles)
"description": one sentence explaining what is happening (same language as articles)
"days_active": how many days this story appeared
"article_count": approximate total articles about this story across all days

If no recurring stories are found, return [].`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const trends = JSON.parse(jsonMatch[0]) as TrendItem[];
    return trends.slice(0, 4);
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/digest/trends.ts
git commit -m "feat: add computeTrends function"
```

---

## Task 4: SourceSuggestions component

**Files:**
- Create: `src/components/settings/SourceSuggestions.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/settings/SourceSuggestions.tsx`:

```tsx
"use client";

import { useState } from "react";

interface Suggestion {
  name: string;
  url: string;
  description: string;
  topic_name: string | null;
}

interface SourceSuggestionsProps {
  digestConfigId?: string;
  interests?: string[];
  onAdd: (suggestion: { name: string; url: string; topic_name: string | null }) => void;
}

export function SourceSuggestions({
  digestConfigId,
  interests,
  onAdd,
}: SourceSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  async function handleFetch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sources/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          digestConfigId ? { digestConfigId } : { interests }
        ),
      });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setFetched(true);
    } catch {
      setError("Não foi possível buscar sugestões. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function dismiss(index: number) {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAdd(s: Suggestion, index: number) {
    onAdd({ name: s.name, url: s.url, topic_name: s.topic_name });
    dismiss(index);
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={handleFetch}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="inline-block animate-spin">⟳</span>
            <span>Buscando sugestões...</span>
          </>
        ) : (
          <>
            <span>✨</span>
            <span>Sugerir fontes com IA</span>
          </>
        )}
      </button>

      {error && <p className="text-xs text-danger mt-2">{error}</p>}

      {fetched && !error && suggestions.length === 0 && (
        <p className="text-sm text-text-muted mt-2">Nenhuma sugestão encontrada.</p>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2 mt-3">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-3 p-3 bg-surface rounded-md border border-border"
            >
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="font-medium text-sm text-text">{s.name}</span>
                <span className="text-xs text-text-muted truncate">{s.url}</span>
                <span className="text-xs text-text-secondary mt-0.5">{s.description}</span>
                {s.topic_name && (
                  <span className="text-xs text-primary mt-0.5">{s.topic_name}</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAdd(s, i)}
                  className="text-xs px-2 py-1 bg-primary text-white rounded hover:bg-primary-hover transition-colors"
                >
                  + Adicionar
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(i)}
                  className="text-xs px-2 py-1 text-text-muted hover:text-text transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/SourceSuggestions.tsx
git commit -m "feat: add SourceSuggestions component"
```

---

## Task 5: TrendingSection component

**Files:**
- Create: `src/components/feed/TrendingSection.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/feed/TrendingSection.tsx`:

```tsx
import type { TrendItem } from "@/types";

interface TrendingSectionProps {
  trends: TrendItem[];
}

export function TrendingSection({ trends }: TrendingSectionProps) {
  if (trends.length === 0) return null;

  return (
    <div className="py-4 border-b border-border">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
        📈 Em alta
      </p>
      <div className="flex flex-col">
        {trends.map((trend, i) => (
          <div
            key={i}
            className="flex flex-col gap-0.5 py-2 border-b border-border/30 last:border-0"
          >
            <span className="text-sm font-semibold text-text">{trend.title}</span>
            <p className="text-xs text-text-secondary leading-relaxed">
              {trend.description}
            </p>
            <span className="text-xs text-text-muted mt-0.5">
              {trend.days_active} dias · {trend.article_count} artigos
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/feed/TrendingSection.tsx
git commit -m "feat: add TrendingSection component"
```

---

## Task 6: Wire SourceSuggestions into SourcesList (Settings)

**Files:**
- Modify: `src/components/settings/SourcesList.tsx`

**Context:** `SourcesList` receives `sources`, `topics`, `onRefresh`, `configId` as props. The `POST /api/sources` route validates the URL with `isValidRssUrl` and returns 400 for invalid URLs — the handler must surface this as an inline error.

- [ ] **Step 1: Add the import, error state, handler, and component**

In `src/components/settings/SourcesList.tsx`, make these changes:

**Add import at top:**
```ts
import { SourceSuggestions } from "./SourceSuggestions";
```

**Add state inside the component (after existing state declarations):**
```ts
const [suggestionError, setSuggestionError] = useState<string | null>(null);
```

**Add handler (after `handleDelete`):**
```ts
async function handleSuggestionAdd(suggestion: {
  name: string;
  url: string;
  topic_name: string | null;
}) {
  setSuggestionError(null);
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
    setSuggestionError(
      "Não foi possível adicionar esta fonte. A URL pode ser inválida."
    );
    return;
  }
  onRefresh();
}
```

**In the JSX, add `<SourceSuggestions>` and error message below the header row (before the empty-state check):**

Change the header section from:
```tsx
<div className="flex items-center justify-between mb-4">
  <h2 className="text-lg font-semibold">Fontes RSS</h2>
  <Button
    size="sm"
    onClick={() => {
      setEditing(undefined);
      setModalOpen(true);
    }}
  >
    + Novo
  </Button>
</div>
```

To:
```tsx
<div className="flex items-center justify-between mb-3">
  <h2 className="text-lg font-semibold">Fontes RSS</h2>
  <Button
    size="sm"
    onClick={() => {
      setEditing(undefined);
      setModalOpen(true);
    }}
  >
    + Novo
  </Button>
</div>
<SourceSuggestions digestConfigId={configId} onAdd={handleSuggestionAdd} />
{suggestionError && (
  <p className="text-xs text-danger mb-3">{suggestionError}</p>
)}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/SourcesList.tsx
git commit -m "feat: wire SourceSuggestions into SourcesList"
```

---

## Task 7: Wire SourceSuggestions into StepSources (Wizard)

**Files:**
- Modify: `src/components/wizard/StepSources.tsx`

**Context:** `StepSources` receives `interests` (string[]) and `sources` (WizardSource[]). The `addSource` function appends to the sources array. For AI-suggested sources, `testResult: null` intentionally bypasses the SourceAdder test flow — this is valid per the `WizardSource` type.

- [ ] **Step 1: Add the import and handler**

In `src/components/wizard/StepSources.tsx`:

**Add import at top:**
```ts
import { SourceSuggestions } from "@/components/settings/SourceSuggestions";
```

**Add handler inside `StepSources` (after `updateWeight`):**
```ts
function handleSuggestionAdd(suggestion: {
  name: string;
  url: string;
  topic_name: string | null;
}) {
  addSource({
    name: suggestion.name,
    url: suggestion.url,
    weight: 3,
    interest: suggestion.topic_name,
    testResult: null, // intentionally bypasses the SourceAdder test flow
  });
}
```

**In the JSX, add `<SourceSuggestions>` at the top of the returned `<div>`, before the existing description paragraph:**

Change the opening of the return from:
```tsx
return (
  <div className="flex flex-col gap-5 max-w-xl mx-auto">
    <div>
      <h2 className="text-xl font-bold mb-1">Adicione suas fontes</h2>
      <p className="text-text-secondary text-sm">
```

To:
```tsx
return (
  <div className="flex flex-col gap-5 max-w-xl mx-auto">
    <SourceSuggestions interests={interests} onAdd={handleSuggestionAdd} />
    <div>
      <h2 className="text-xl font-bold mb-1">Adicione suas fontes</h2>
      <p className="text-text-secondary text-sm">
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/StepSources.tsx
git commit -m "feat: wire SourceSuggestions into Wizard StepSources"
```

---

## Task 8: Integrate computeTrends into generator

**Files:**
- Modify: `src/lib/digest/generator.ts`

**Context:** The generator's final step (lines ~136–146) calls `generateDaySummary` then does a single `.update()` writing `status: "completed"`, `summary`, and `metadata`. The `computeTrends` call must happen between those two lines, and its result merged into that same update object. There must be only ONE metadata update for the completed status.

Current code (lines ~136–146):
```ts
const daySummary = await generateDaySummary(processed.map((a) => a.summary), settings.language);

await supabase.from("digests").update({
  status: "completed",
  summary: daySummary,
  metadata: {
    total_articles: processed.length,
    sources_count: new Set(processed.map((a) => a.source_name)).size,
    topics_count: new Set(processed.filter((a) => a.topic_id).map((a) => a.topic_id)).size,
  },
}).eq("id", digest.id);
```

- [ ] **Step 1: Add import and update the final block**

**Add import at top of `generator.ts` (alongside existing imports):**
```ts
import { computeTrends } from "@/lib/digest/trends";
import type { DigestMetadata } from "@/types";
```

**Replace the final block (from `const daySummary` through `.eq("id", digest.id)`) with:**
```ts
const daySummary = await generateDaySummary(processed.map((a) => a.summary), settings.language);
const trends = await computeTrends(digestConfigId ?? "", digest.id, supabase);

const metadata: DigestMetadata = {
  total_articles: processed.length,
  sources_count: new Set(processed.map((a) => a.source_name)).size,
  topics_count: new Set(processed.filter((a) => a.topic_id).map((a) => a.topic_id)).size,
  ...(trends.length > 0 ? { trends } : {}),
};

await supabase.from("digests").update({
  status: "completed",
  summary: daySummary,
  metadata,
}).eq("id", digest.id);
```

**Note:** `digestConfigId` is already a parameter of `generateDigest`. When it is undefined (legacy non-config digests), `computeTrends` will receive `""` as configId and will return `[]` from the early-return guard — safe.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/digest/generator.ts
git commit -m "feat: compute and store trends during digest generation"
```

---

## Task 9: Wire TrendingSection into the feed + final build

**Files:**
- Modify: `src/app/page.tsx`

**Context:** The feed page loads the current digest as `current` (type `DigestWithArticles`, which extends `Digest`). With `Digest.metadata` now typed as `DigestMetadata`, `current.metadata.trends` is `TrendItem[] | undefined` — no cast needed. Place `<TrendingSection>` between `<DaySummary>` and `<HighlightCards>`.

- [ ] **Step 1: Add import and render TrendingSection**

In `src/app/page.tsx`:

**Add import** (alongside existing feed component imports):
```ts
import { TrendingSection } from "@/components/feed/TrendingSection";
```

**In the JSX, between `<DaySummary>` and `<HighlightCards>`, add:**
```tsx
{current.metadata?.trends && current.metadata.trends.length > 0 && (
  <TrendingSection trends={current.metadata.trends} />
)}
```

- [ ] **Step 2: Full production build**

```bash
cd C:\Users\Gabriel\Documents\GitHub\jay-news
npm run build 2>&1
```

Expected:
```
✓ Compiled successfully
✓ Generating static pages (18/18)
```

No TypeScript errors, no missing modules.

- [ ] **Step 3: Push**

```bash
git add src/app/page.tsx
git commit -m "feat: render TrendingSection in feed between DaySummary and HighlightCards"
git push origin $(git branch --show-current)
```

---

## Verification Checklist

After all tasks:

- [ ] `POST /api/sources/suggest` with `{ interests: ["cripto"] }` returns a JSON array of suggestions
- [ ] Settings page shows "✨ Sugerir fontes com IA" button in the sources section
- [ ] Wizard sources step shows "✨ Sugerir fontes com IA" above the interest sections
- [ ] A generated digest has `metadata.trends` populated (visible in Supabase dashboard after running "Gerar Digest")
- [ ] Feed shows "📈 Em alta" section above highlights when trends exist
- [ ] Build passes clean: `npm run build`
