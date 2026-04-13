# Phase 1: Wizard + Source Testing + Weights + Multi-Digest — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform jay-news into a multi-digest platform with a step-by-step creation wizard, source testing, and per-source weights.

**Architecture:** New `digest_configs` table becomes the central entity. All existing tables (topics, sources, alerts, exclusions, digests) gain a `digest_config_id` FK. The wizard creates a config + all linked data in one flow. The generator pipeline is updated to accept a config ID and use weight-based article caps/boosts.

**Tech Stack:** Next.js 16, React 19, Supabase (PostgreSQL + RLS + Auth), TailwindCSS 4, rss-parser, Anthropic SDK

**Spec:** `docs/superpowers/specs/2026-04-12-phase1-wizard-sources-weights-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/002_multi_digest.sql` | Schema: new table, ALTER columns, indexes, RLS, data migration |
| `src/app/api/digest-configs/route.ts` | CRUD API for digest configurations |
| `src/app/api/sources/test/route.ts` | RSS URL test endpoint (no persistence) |
| `src/components/wizard/WizardStepper.tsx` | Horizontal 4-step progress indicator |
| `src/components/wizard/StepInterests.tsx` | Step 1: name, emoji, color, interests |
| `src/components/wizard/StepSources.tsx` | Step 2: add/test sources per interest |
| `src/components/wizard/StepPreferences.tsx` | Step 3: language, style, time, max, exclusions |
| `src/components/wizard/StepReview.tsx` | Step 4: summary + generate first digest |
| `src/components/wizard/SourceTestCard.tsx` | RSS test result preview card |
| `src/components/wizard/WeightStars.tsx` | Clickable 1-5 star weight selector |
| `src/components/feed/DigestTabs.tsx` | Horizontal scrollable tab bar for digest configs |
| `src/app/wizard/page.tsx` | Wizard page orchestrating all steps |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `DigestConfig`, `SourceTestResult` types; add `digest_config_id`/`weight` to existing interfaces |
| `src/app/api/topics/route.ts` | Add `digest_config_id` param to GET filter and POST insert |
| `src/app/api/sources/route.ts` | Add `digest_config_id` param + `weight` field |
| `src/app/api/alerts/route.ts` | Add `digest_config_id` param |
| `src/app/api/exclusions/route.ts` | Add `digest_config_id` param |
| `src/app/api/digest/generate/route.ts` | Accept `digestConfigId`, update cron path |
| `src/app/api/digests/route.ts` | Accept `digestConfigId` query filter |
| `src/lib/digest/generator.ts` | Load from `digest_configs`, weight-based caps/boost |
| `src/app/page.tsx` | Add DigestTabs, scope feed by config, redirect if no configs |
| `src/app/settings/page.tsx` | Scope by configId, add weight/test to sources |
| `src/components/settings/SourcesList.tsx` | Add weight stars display + test button |
| `src/components/settings/SourceModal.tsx` | Add weight slider field |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/002_multi_digest.sql`

- [ ] **Step 1: Write the migration SQL file**

Create `supabase/migrations/002_multi_digest.sql` with the full migration:

```sql
-- 1. Create digest_configs table
CREATE TABLE digest_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📰',
  color TEXT DEFAULT '#fb830e',
  language TEXT NOT NULL DEFAULT 'pt-BR',
  summary_style TEXT NOT NULL DEFAULT 'executive' CHECK (summary_style IN ('executive', 'detailed')),
  digest_time TIME NOT NULL DEFAULT '07:00',
  max_articles INTEGER NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_digest_configs_user ON digest_configs(user_id);

-- 2. Add digest_config_id to existing tables
ALTER TABLE topics ADD COLUMN digest_config_id UUID REFERENCES digest_configs(id) ON DELETE CASCADE;
ALTER TABLE rss_sources ADD COLUMN digest_config_id UUID REFERENCES digest_configs(id) ON DELETE CASCADE;
ALTER TABLE rss_sources ADD COLUMN weight INTEGER NOT NULL DEFAULT 3 CHECK (weight >= 1 AND weight <= 5);
ALTER TABLE alerts ADD COLUMN digest_config_id UUID REFERENCES digest_configs(id) ON DELETE CASCADE;
ALTER TABLE exclusions ADD COLUMN digest_config_id UUID REFERENCES digest_configs(id) ON DELETE CASCADE;
ALTER TABLE digests ADD COLUMN digest_config_id UUID REFERENCES digest_configs(id) ON DELETE SET NULL;

-- 3. Indexes
CREATE INDEX idx_topics_config ON topics(digest_config_id);
CREATE INDEX idx_rss_sources_config ON rss_sources(digest_config_id);
CREATE INDEX idx_alerts_config ON alerts(digest_config_id);
CREATE INDEX idx_exclusions_config ON exclusions(digest_config_id);
CREATE INDEX idx_digests_config ON digests(digest_config_id);

-- 4. Data migration: ensure all users with data have user_settings
INSERT INTO user_settings (user_id)
SELECT DISTINCT user_id FROM (
  SELECT user_id FROM topics
  UNION SELECT user_id FROM rss_sources
  UNION SELECT user_id FROM alerts
  UNION SELECT user_id FROM exclusions
  UNION SELECT user_id FROM digests
) all_users
WHERE user_id NOT IN (SELECT user_id FROM user_settings)
ON CONFLICT DO NOTHING;

-- 5. Create default digest_config per user
INSERT INTO digest_configs (user_id, name, icon, language, summary_style, digest_time, max_articles)
SELECT user_id, 'Meu Digest', '📰', language, summary_style, digest_time, max_articles
FROM user_settings;

-- 6. Link existing records
UPDATE topics SET digest_config_id = (
  SELECT id FROM digest_configs WHERE digest_configs.user_id = topics.user_id ORDER BY created_at ASC LIMIT 1
);
UPDATE rss_sources SET digest_config_id = (
  SELECT id FROM digest_configs WHERE digest_configs.user_id = rss_sources.user_id ORDER BY created_at ASC LIMIT 1
);
UPDATE alerts SET digest_config_id = (
  SELECT id FROM digest_configs WHERE digest_configs.user_id = alerts.user_id ORDER BY created_at ASC LIMIT 1
);
UPDATE exclusions SET digest_config_id = (
  SELECT id FROM digest_configs WHERE digest_configs.user_id = exclusions.user_id ORDER BY created_at ASC LIMIT 1
);
UPDATE digests SET digest_config_id = (
  SELECT id FROM digest_configs WHERE digest_configs.user_id = digests.user_id ORDER BY created_at ASC LIMIT 1
);

-- 7. Make digest_config_id NOT NULL on config tables (not digests — keep nullable for history)
ALTER TABLE topics ALTER COLUMN digest_config_id SET NOT NULL;
ALTER TABLE rss_sources ALTER COLUMN digest_config_id SET NOT NULL;
ALTER TABLE alerts ALTER COLUMN digest_config_id SET NOT NULL;
ALTER TABLE exclusions ALTER COLUMN digest_config_id SET NOT NULL;

-- 8. RLS for digest_configs
ALTER TABLE digest_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own configs" ON digest_configs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own configs" ON digest_configs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own configs" ON digest_configs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own configs" ON digest_configs FOR DELETE USING (user_id = auth.uid());
```

- [ ] **Step 2: Apply migration to Supabase**

Run via Supabase dashboard SQL editor or CLI:
```bash
npx supabase db push
```

If using dashboard, paste the SQL and execute. Verify no errors.

- [ ] **Step 3: Verify migration**

Check tables exist and data migrated:
```sql
SELECT count(*) FROM digest_configs;
SELECT count(*) FROM topics WHERE digest_config_id IS NOT NULL;
SELECT count(*) FROM rss_sources WHERE digest_config_id IS NOT NULL;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_multi_digest.sql
git commit -m "feat: add digest_configs table and multi-digest migration"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add DigestConfig interface and SourceTestResult**

Add after the existing `UserSettings` interface (line 9):

```typescript
export interface DigestConfig {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  language: string;
  summary_style: "executive" | "detailed";
  digest_time: string;
  max_articles: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SourceTestResult {
  status: "success" | "error";
  feed_name?: string;
  total_articles?: number;
  sample_articles?: { title: string; published_at: string | null; url: string }[];
  error_code?: string;
  error_message?: string;
}
```

- [ ] **Step 2: Add `digest_config_id` to existing interfaces**

Update each interface:

In `Topic` (line 11-19), add after `user_id`:
```typescript
  digest_config_id: string;
```

In `RssSource` (line 21-29), add after `user_id` and `topic_id`:
```typescript
  digest_config_id: string;
  weight: number;
```

In `Alert` (line 31-39), add after `user_id`:
```typescript
  digest_config_id: string;
```

In `Exclusion` (line 41-47), add after `user_id`:
```typescript
  digest_config_id: string;
```

In `Digest` (line 49-57), add after `user_id`:
```typescript
  digest_config_id: string | null;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "C:/Users/Gabriel/Documents/GitHub/jay-news" && npx tsc --noEmit 2>&1 | head -20
```

Expect type errors in files that use these interfaces but don't yet pass `digest_config_id` — that's expected and will be fixed in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add DigestConfig type and digest_config_id to all interfaces"
```

---

## Task 3: Digest Configs CRUD API

**Files:**
- Create: `src/app/api/digest-configs/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("digest_configs")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("digest_configs")
    .insert({
      user_id: user.id,
      name: body.name,
      icon: body.icon || "📰",
      color: body.color || "#fb830e",
      language: body.language || "pt-BR",
      summary_style: body.summary_style || "executive",
      digest_time: body.digest_time || "07:00",
      max_articles: body.max_articles || 20,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;

  const { data, error } = await supabase
    .from("digest_configs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Soft delete — cascading deletes on DB handle linked data
  const { error } = await supabase
    .from("digest_configs")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/digest-configs/route.ts
git commit -m "feat: add digest-configs CRUD API endpoint"
```

---

## Task 4: Source Test API Endpoint

**Files:**
- Create: `src/app/api/sources/test/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isValidRssUrl } from "@/lib/sources/validate-url";
import Parser from "rss-parser";

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "JNews/1.0" },
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await request.json();

  if (!url || !isValidRssUrl(url)) {
    return NextResponse.json({
      status: "error",
      error_code: "INVALID_URL",
      error_message: "URL invalida ou nao permitida",
    });
  }

  try {
    const feed = await parser.parseURL(url);

    if (!feed.items || feed.items.length === 0) {
      return NextResponse.json({
        status: "error",
        error_code: "EMPTY_FEED",
        error_message: "Feed encontrado mas sem artigos",
      });
    }

    const sampleArticles = feed.items.slice(0, 2).map((item) => ({
      title: item.title || "Sem titulo",
      published_at: item.isoDate || null,
      url: item.link || url,
    }));

    return NextResponse.json({
      status: "success",
      feed_name: feed.title || "Feed sem nome",
      total_articles: feed.items.length,
      sample_articles: sampleArticles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
      return NextResponse.json({
        status: "error",
        error_code: "TIMEOUT",
        error_message: "Timeout ao acessar a URL (10s)",
      });
    }

    if (message.includes("ENOTFOUND") || message.includes("ECONNREFUSED")) {
      return NextResponse.json({
        status: "error",
        error_code: "UNREACHABLE",
        error_message: "URL inacessivel — verifique o endereco",
      });
    }

    return NextResponse.json({
      status: "error",
      error_code: "INVALID_RSS",
      error_message: "URL nao e um feed RSS/Atom valido",
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/sources/test/route.ts
git commit -m "feat: add RSS source test endpoint"
```

---

## Task 5: Update Existing CRUD APIs for `digest_config_id`

**Files:**
- Modify: `src/app/api/topics/route.ts`
- Modify: `src/app/api/sources/route.ts`
- Modify: `src/app/api/alerts/route.ts`
- Modify: `src/app/api/exclusions/route.ts`
- Modify: `src/app/api/digests/route.ts`

- [ ] **Step 1: Update topics API**

In `src/app/api/topics/route.ts`:

**GET** — add `digestConfigId` filter. Replace the query (lines 12-16):
```typescript
  const { searchParams } = new URL(request.url);
  const digestConfigId = searchParams.get("digestConfigId");

  let query = supabase
    .from("topics")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (digestConfigId) {
    query = query.eq("digest_config_id", digestConfigId);
  }

  const { data, error } = await query;
```

Note: the `GET` function signature changes from `GET()` to `GET(request: Request)`.

**POST** — include `digest_config_id` in insert. In the insert (line 33):
```typescript
    .insert({ ...body, user_id: user.id, digest_config_id: body.digest_config_id })
```

- [ ] **Step 2: Update sources API**

In `src/app/api/sources/route.ts`:

**GET** — same pattern as topics: add `request: Request` param, parse `digestConfigId`, filter.

**POST** — include `digest_config_id` and `weight`:
```typescript
    .insert({ ...body, user_id: user.id, digest_config_id: body.digest_config_id, weight: body.weight ?? 3 })
```

- [ ] **Step 3: Update alerts API**

Same pattern: add `digestConfigId` filter to GET, include `digest_config_id` in POST insert.

- [ ] **Step 4: Update exclusions API**

Same pattern: add `digestConfigId` filter to GET, include `digest_config_id` in POST insert.

- [ ] **Step 5: Update digests API**

In `src/app/api/digests/route.ts`, add `digestConfigId` query param:
```typescript
  const digestConfigId = searchParams.get("digestConfigId");

  let query = supabase
    .from("digests")
    .select("id, generated_at, type, status, summary, digest_config_id")
    .order("generated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (digestConfigId) {
    query = query.eq("digest_config_id", digestConfigId);
  }

  const { data, error } = await query;
```

- [ ] **Step 6: Verify app still compiles**

```bash
cd "C:/Users/Gabriel/Documents/GitHub/jay-news" && npx next build 2>&1 | tail -20
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/topics/route.ts src/app/api/sources/route.ts src/app/api/alerts/route.ts src/app/api/exclusions/route.ts src/app/api/digests/route.ts
git commit -m "feat: add digest_config_id filtering to all CRUD APIs"
```

---

## Task 6: Update Generator Pipeline

**Files:**
- Modify: `src/lib/digest/generator.ts`
- Modify: `src/app/api/digest/generate/route.ts`

- [ ] **Step 1: Update generator to accept digestConfigId**

In `src/lib/digest/generator.ts`, change the function signature:

```typescript
export async function generateDigest(userId: string, type: "scheduled" | "on_demand", digestConfigId?: string): Promise<string> {
```

Replace the config loading section (lines 18-30) with:

```typescript
  // Load digest config
  let settings: { language: string; summary_style: string; max_articles: number; digest_time: string };

  if (digestConfigId) {
    const { data: config } = await supabase
      .from("digest_configs")
      .select("*")
      .eq("id", digestConfigId)
      .single();

    if (!config) throw new Error(`Digest config not found: ${digestConfigId}`);
    settings = config;
  } else {
    const { data: settingsData } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();
    settings = settingsData || {
      language: "pt-BR", summary_style: "executive", max_articles: 20, digest_time: "07:00",
    };
  }

  // Load config-scoped data
  const configFilter = digestConfigId
    ? { column: "digest_config_id", value: digestConfigId }
    : { column: "user_id", value: userId };

  const [topicsRes, sourcesRes, alertsRes, exclusionsRes] = await Promise.all([
    supabase.from("topics").select("*").eq(configFilter.column, configFilter.value).eq("is_active", true),
    supabase.from("rss_sources").select("*").eq(configFilter.column, configFilter.value).eq("is_active", true),
    supabase.from("alerts").select("*").eq(configFilter.column, configFilter.value).eq("is_active", true),
    supabase.from("exclusions").select("*").eq(configFilter.column, configFilter.value).eq("is_active", true),
  ]);

  const topics: Topic[] = topicsRes.data || [];
  const sources: RssSource[] = sourcesRes.data || [];
  const alerts: Alert[] = alertsRes.data || [];
  const exclusions: Exclusion[] = exclusionsRes.data || [];
```

- [ ] **Step 2: Update RSS cap to use weight**

Replace the hard-coded RSS cap section (lines 72-79) with:

```typescript
    // Cap RSS per-source based on weight (weight * 2)
    const cappedRss = Object.values(
      rssArticles.reduce<Record<string, { articles: typeof rssArticles; weight: number }>>((acc, a) => {
        const source = sources.find((s) => s.name === a.source_name);
        const weight = source?.weight ?? 3;
        const cap = weight * 2;
        if (!acc[a.source_name]) acc[a.source_name] = { articles: [], weight };
        if (acc[a.source_name].articles.length < cap) acc[a.source_name].articles.push(a);
        return acc;
      }, {})
    ).flatMap((s) => s.articles);
```

- [ ] **Step 3: Apply weight boost after Claude scoring**

In `src/lib/digest/processor.ts`, update `processArticles` to accept sources and apply weight boost. Change signature (line 34):

```typescript
export async function processArticles(rawArticles: RawArticle[], topics: Topic[], language: string, style: string, sources?: RssSource[]): Promise<ProcessedArticle[]> {
```

After the sorting (line 72), before marking highlights, add weight boost:

```typescript
  // Apply weight boost from source config
  if (sources) {
    for (const article of processed) {
      const source = sources.find((s) => s.name === article.source_name);
      if (source) {
        article.relevance_score = Math.min(1.0, article.relevance_score * (1 + (source.weight - 3) * 0.1));
      }
    }
  }

  processed.sort((a, b) => b.relevance_score - a.relevance_score);
```

Import `RssSource` type at the top of processor.ts.

- [ ] **Step 4: Pass sources to processArticles in generator**

In `generator.ts` line 90, update the call:

```typescript
    const processed = await processArticles(filtered, topics, settings.language, settings.summary_style, sources);
```

- [ ] **Step 5: Insert digest with digest_config_id**

In `generator.ts`, update the digest insert (line 35-39):

```typescript
  const { data: digest, error: digestError } = await supabase
    .from("digests")
    .insert({ user_id: userId, type, status: "processing", digest_config_id: digestConfigId || null })
    .select()
    .single();
```

- [ ] **Step 6: Update generate API route**

In `src/app/api/digest/generate/route.ts`:

For the user-triggered path (line 29-31), read `digestConfigId` from body:
```typescript
  const body = await request.json().catch(() => ({}));
  const digestConfigId = body.digestConfigId;

  try {
    const digestId = await generateDigest(user.id, "on_demand", digestConfigId);
```

For the cron path (lines 10-22), replace with multi-config iteration:
```typescript
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Filter by current hour to only generate for configs scheduled now
    const currentHour = new Date().toISOString().slice(11, 13) + ":00";
    const nextHour = String((parseInt(currentHour) + 1) % 24).padStart(2, "0") + ":00";

    const { data: configs } = await supabase
      .from("digest_configs")
      .select("id, user_id")
      .eq("is_active", true)
      .gte("digest_time", currentHour)
      .lt("digest_time", nextHour);

    if (!configs || configs.length === 0) {
      return NextResponse.json({ message: "No configs scheduled for this hour" }, { status: 200 });
    }

    const results = [];
    for (const config of configs) {
      try {
        const digestId = await generateDigest(config.user_id, "scheduled", config.id);
        results.push({ configId: config.id, digestId, status: "processing" });
      } catch (error) {
        results.push({ configId: config.id, error: String(error) });
      }
    }

    return NextResponse.json({ results });
  }
```

- [ ] **Step 7: Verify build**

```bash
cd "C:/Users/Gabriel/Documents/GitHub/jay-news" && npx next build 2>&1 | tail -20
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/digest/generator.ts src/lib/digest/processor.ts src/app/api/digest/generate/route.ts
git commit -m "feat: update generator pipeline for multi-digest with weight-based caps and boost"
```

---

## Task 7: WeightStars and SourceTestCard Components

**Files:**
- Create: `src/components/wizard/WeightStars.tsx`
- Create: `src/components/wizard/SourceTestCard.tsx`

- [ ] **Step 1: Create WeightStars component**

```typescript
"use client";

interface WeightStarsProps {
  value: number;
  onChange: (value: number) => void;
  size?: "sm" | "md";
}

export function WeightStars({ value, onChange, size = "md" }: WeightStarsProps) {
  const starSize = size === "sm" ? "text-sm" : "text-lg";

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`${starSize} transition-colors ${
            star <= value ? "text-primary" : "text-text-muted"
          } hover:text-primary-hover`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create SourceTestCard component**

```typescript
"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { SourceTestResult } from "@/types";

interface SourceTestCardProps {
  result: SourceTestResult;
}

export function SourceTestCard({ result }: SourceTestCardProps) {
  if (result.status === "error") {
    return (
      <Card className="border-danger/30 mt-2">
        <div className="flex items-center gap-2 mb-1">
          <Badge className="bg-danger/20 text-danger">Erro</Badge>
          <span className="text-sm text-text-secondary">{result.error_code}</span>
        </div>
        <p className="text-sm text-text-muted">{result.error_message}</p>
      </Card>
    );
  }

  return (
    <Card className="border-success/30 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-success/20 text-success">Fonte valida</Badge>
        <span className="font-medium">{result.feed_name}</span>
        <span className="text-sm text-text-muted">{result.total_articles} artigos</span>
      </div>
      <div className="flex flex-col gap-1">
        {result.sample_articles?.map((article, i) => (
          <div key={i} className="text-sm flex justify-between">
            <span className="text-text-secondary truncate mr-4">{article.title}</span>
            {article.published_at && (
              <span className="text-text-muted text-xs whitespace-nowrap">
                {new Date(article.published_at).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/WeightStars.tsx src/components/wizard/SourceTestCard.tsx
git commit -m "feat: add WeightStars and SourceTestCard components"
```

---

## Task 8: WizardStepper Component

**Files:**
- Create: `src/components/wizard/WizardStepper.tsx`

- [ ] **Step 1: Create the stepper**

```typescript
"use client";

const STEPS = [
  { label: "Interesses", icon: "1" },
  { label: "Fontes", icon: "2" },
  { label: "Preferencias", icon: "3" },
  { label: "Revisao", icon: "4" },
];

interface WizardStepperProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function WizardStepper({ currentStep, onStepClick }: WizardStepperProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        const isClickable = i < currentStep;

        return (
          <div key={i} className="flex items-center">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(i)}
              disabled={!isClickable}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all ${
                isCurrent
                  ? "bg-primary text-white"
                  : isCompleted
                    ? "bg-surface-light text-primary cursor-pointer hover:bg-surface"
                    : "bg-surface text-text-muted cursor-default"
              }`}
            >
              <span className="text-sm font-semibold">
                {isCompleted ? "✓" : step.icon}
              </span>
              <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${isCompleted ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wizard/WizardStepper.tsx
git commit -m "feat: add WizardStepper progress component"
```

---

## Task 9: Wizard Step Components

**Files:**
- Create: `src/components/wizard/StepInterests.tsx`
- Create: `src/components/wizard/StepSources.tsx`
- Create: `src/components/wizard/StepPreferences.tsx`
- Create: `src/components/wizard/StepReview.tsx`

- [ ] **Step 1: Create StepInterests**

```typescript
"use client";

import { Input } from "@/components/ui/Input";
import { ChipInput } from "@/components/ui/ChipInput";
import { Card } from "@/components/ui/Card";

const EMOJI_OPTIONS = ["📰", "💰", "🏆", "💻", "🌍", "📊", "🎯", "🔬", "📈", "⚽"];
const COLOR_OPTIONS = ["#fb830e", "#08a6ff", "#75f94c", "#f54336", "#c0b662", "#a855f7"];

interface StepInterestsProps {
  name: string;
  icon: string;
  color: string;
  interests: string[];
  onNameChange: (name: string) => void;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
  onInterestsChange: (interests: string[]) => void;
}

export function StepInterests({
  name, icon, color, interests,
  onNameChange, onIconChange, onColorChange, onInterestsChange,
}: StepInterestsProps) {
  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-xl font-bold mb-2">Como vai se chamar seu digest?</h2>
        <p className="text-text-secondary text-sm mb-4">
          Escolha um nome, icone e cor para identificar este digest.
        </p>
        <Input
          label="Nome do Digest"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Ex: Trading, Tech News, Politica"
          required
        />
      </div>

      <div className="flex gap-6">
        <div>
          <label className="text-sm text-text-secondary font-medium mb-2 block">Icone</label>
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onIconChange(emoji)}
                className={`w-10 h-10 rounded-md text-lg flex items-center justify-center transition-all ${
                  icon === emoji ? "bg-primary/20 ring-2 ring-primary" : "bg-surface hover:bg-surface-light"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-text-secondary font-medium mb-2 block">Cor</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColorChange(c)}
                className={`w-10 h-10 rounded-full transition-all ${
                  color === c ? "ring-2 ring-white ring-offset-2 ring-offset-background" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-2">Quais seus interesses?</h2>
        <p className="text-text-secondary text-sm mb-4">
          Cada interesse vira uma categoria no seu digest. Adicione pelo menos um.
        </p>
        <ChipInput
          label="Interesses"
          values={interests}
          onChange={onInterestsChange}
          placeholder="empreendedorismo, IA, day trade..."
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create StepSources**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { WeightStars } from "./WeightStars";
import { SourceTestCard } from "./SourceTestCard";
import type { SourceTestResult } from "@/types";

interface WizardSource {
  name: string;
  url: string;
  weight: number;
  interest: string | null;
  testResult: SourceTestResult | null;
}

interface StepSourcesProps {
  interests: string[];
  sources: WizardSource[];
  onSourcesChange: (sources: WizardSource[]) => void;
}

function SourceAdder({ interest, onAdd }: { interest: string | null; onAdd: (source: WizardSource) => void }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [weight, setWeight] = useState(3);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SourceTestResult | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/sources/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const result: SourceTestResult = await res.json();
      setTestResult(result);
      if (result.status === "success" && result.feed_name && !name) {
        setName(result.feed_name);
      }
    } finally {
      setTesting(false);
    }
  }

  function handleConfirm() {
    onAdd({ name, url, weight, interest, testResult });
    setUrl("");
    setName("");
    setWeight(3);
    setTestResult(null);
    setShowForm(false);
  }

  if (!showForm) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
        + Adicionar fonte
      </Button>
    );
  }

  return (
    <Card className="mt-2">
      <div className="flex gap-2 items-end mb-2">
        <Input
          label="URL do RSS"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/rss"
          className="flex-1"
        />
        <Button size="sm" onClick={handleTest} loading={testing} disabled={!url}>
          Testar
        </Button>
      </div>

      {testResult && <SourceTestCard result={testResult} />}

      {testResult?.status === "success" && (
        <div className="flex flex-col gap-3 mt-3">
          <Input
            label="Nome da fonte"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: TechCrunch"
          />
          <div className="flex items-center justify-between">
            <label className="text-sm text-text-secondary font-medium">Peso</label>
            <WeightStars value={weight} onChange={setWeight} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={!name}>
              Confirmar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function StepSources({ interests, sources, onSourcesChange }: StepSourcesProps) {
  function addSource(source: WizardSource) {
    onSourcesChange([...sources, source]);
  }

  function removeSource(index: number) {
    onSourcesChange(sources.filter((_, i) => i !== index));
  }

  const sections = [
    ...interests.map((interest) => ({ label: interest, key: interest })),
    { label: "Fontes gerais", key: null as string | null },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-xl font-bold mb-2">Adicione suas fontes</h2>
        <p className="text-text-secondary text-sm mb-4">
          Adicione feeds RSS para cada interesse. Teste antes de confirmar.
        </p>
      </div>

      {sections.map((section) => {
        const sectionSources = sources.filter((s) => s.interest === section.key);
        return (
          <Card key={section.label}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{section.label}</h3>
              <span className="text-sm text-text-muted">
                {sectionSources.length} fonte{sectionSources.length !== 1 ? "s" : ""}
              </span>
            </div>

            {sectionSources.map((source, i) => {
              const globalIndex = sources.indexOf(source);
              return (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-surface mb-1">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{source.name}</span>
                    <span className="text-xs text-text-muted">{source.url}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <WeightStars value={source.weight} onChange={(w) => {
                      const updated = [...sources];
                      updated[globalIndex] = { ...source, weight: w };
                      onSourcesChange(updated);
                    }} size="sm" />
                    <Button variant="ghost" size="sm" onClick={() => removeSource(globalIndex)}>
                      ✕
                    </Button>
                  </div>
                </div>
              );
            })}

            <SourceAdder interest={section.key} onAdd={addSource} />
          </Card>
        );
      })}
    </div>
  );
}

export type { WizardSource };
```

- [ ] **Step 3: Create StepPreferences**

```typescript
"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ChipInput } from "@/components/ui/ChipInput";

interface StepPreferencesProps {
  language: string;
  summaryStyle: string;
  digestTime: string;
  maxArticles: number;
  exclusions: string[];
  onLanguageChange: (v: string) => void;
  onSummaryStyleChange: (v: string) => void;
  onDigestTimeChange: (v: string) => void;
  onMaxArticlesChange: (v: number) => void;
  onExclusionsChange: (v: string[]) => void;
}

const LANGUAGE_OPTIONS = [
  { value: "pt-BR", label: "Portugues (BR)" },
  { value: "en", label: "English" },
  { value: "es", label: "Espanol" },
];

const STYLE_OPTIONS = [
  { value: "executive", label: "Executivo (2-3 frases)" },
  { value: "detailed", label: "Detalhado (4-5 frases)" },
];

export function StepPreferences({
  language, summaryStyle, digestTime, maxArticles, exclusions,
  onLanguageChange, onSummaryStyleChange, onDigestTimeChange, onMaxArticlesChange, onExclusionsChange,
}: StepPreferencesProps) {
  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-xl font-bold mb-2">Preferencias</h2>
        <p className="text-text-secondary text-sm mb-4">
          Configure como seu digest sera gerado.
        </p>
      </div>

      <Select label="Idioma" value={language} onChange={(e) => onLanguageChange(e.target.value)} options={LANGUAGE_OPTIONS} />
      <Select label="Estilo do resumo" value={summaryStyle} onChange={(e) => onSummaryStyleChange(e.target.value)} options={STYLE_OPTIONS} />
      <Input label="Horario do digest" type="time" value={digestTime} onChange={(e) => onDigestTimeChange(e.target.value)} />
      <Input label="Maximo de artigos" type="number" value={maxArticles} onChange={(e) => onMaxArticlesChange(parseInt(e.target.value) || 20)} min={5} max={50} />
      <ChipInput label="Exclusoes (palavras para filtrar)" values={exclusions} onChange={onExclusionsChange} placeholder="spam, clickbait..." />
    </div>
  );
}
```

- [ ] **Step 4: Create StepReview**

```typescript
"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { WeightStars } from "./WeightStars";
import type { WizardSource } from "./StepSources";

interface StepReviewProps {
  name: string;
  icon: string;
  color: string;
  interests: string[];
  sources: WizardSource[];
  language: string;
  summaryStyle: string;
  digestTime: string;
  maxArticles: number;
  exclusions: string[];
}

export function StepReview({
  name, icon, color, interests, sources, language, summaryStyle, digestTime, maxArticles, exclusions,
}: StepReviewProps) {
  const langLabel: Record<string, string> = { "pt-BR": "Portugues (BR)", en: "English", es: "Espanol" };
  const styleLabel: Record<string, string> = { executive: "Executivo", detailed: "Detalhado" };

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto">
      <h2 className="text-xl font-bold mb-2">Revise seu digest</h2>

      <Card>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">{icon}</span>
          <span className="text-lg font-bold">{name}</span>
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">Interesses ({interests.length})</h3>
        <div className="flex flex-wrap gap-2">
          {interests.map((interest) => (
            <Badge key={interest}>{interest}</Badge>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">Fontes ({sources.length})</h3>
        <div className="flex flex-col gap-1">
          {sources.map((source, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Badge className={source.testResult?.status === "success" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}>
                  {source.testResult?.status === "success" ? "OK" : "?"}
                </Badge>
                <span>{source.name}</span>
                {source.interest && <span className="text-text-muted">({source.interest})</span>}
              </div>
              <WeightStars value={source.weight} onChange={() => {}} size="sm" />
            </div>
          ))}
          {sources.length === 0 && <p className="text-text-muted text-sm">Nenhuma fonte adicionada</p>}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">Preferencias</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-text-secondary">Idioma:</span>
          <span>{langLabel[language] || language}</span>
          <span className="text-text-secondary">Estilo:</span>
          <span>{styleLabel[summaryStyle] || summaryStyle}</span>
          <span className="text-text-secondary">Horario:</span>
          <span>{digestTime}</span>
          <span className="text-text-secondary">Max artigos:</span>
          <span>{maxArticles}</span>
          {exclusions.length > 0 && (
            <>
              <span className="text-text-secondary">Exclusoes:</span>
              <span>{exclusions.join(", ")}</span>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/wizard/StepInterests.tsx src/components/wizard/StepSources.tsx src/components/wizard/StepPreferences.tsx src/components/wizard/StepReview.tsx
git commit -m "feat: add all wizard step components"
```

---

## Task 10: Wizard Page

**Files:**
- Create: `src/app/wizard/page.tsx`

- [ ] **Step 1: Create the wizard page**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { WizardStepper } from "@/components/wizard/WizardStepper";
import { StepInterests } from "@/components/wizard/StepInterests";
import { StepSources, type WizardSource } from "@/components/wizard/StepSources";
import { StepPreferences } from "@/components/wizard/StepPreferences";
import { StepReview } from "@/components/wizard/StepReview";
import type { DigestWithArticles } from "@/types";

export default function WizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedDigest, setGeneratedDigest] = useState<DigestWithArticles | null>(null);

  // Step 1 state
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📰");
  const [color, setColor] = useState("#fb830e");
  const [interests, setInterests] = useState<string[]>([]);

  // Step 2 state
  const [sources, setSources] = useState<WizardSource[]>([]);

  // Step 3 state
  const [language, setLanguage] = useState("pt-BR");
  const [summaryStyle, setSummaryStyle] = useState("executive");
  const [digestTime, setDigestTime] = useState("07:00");
  const [maxArticles, setMaxArticles] = useState(20);
  const [exclusions, setExclusions] = useState<string[]>([]);

  const canProceed = [
    name.trim() && interests.length > 0,  // step 0
    true,                                   // step 1 (sources optional)
    true,                                   // step 2 (all have defaults)
    true,                                   // step 3 (review)
  ];

  async function saveConfig(): Promise<string> {
    // 1. Create digest config
    const configRes = await fetch("/api/digest-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, icon, color, language, summary_style: summaryStyle, digest_time: digestTime, max_articles: maxArticles }),
    });
    const config = await configRes.json();
    const configId = config.id;

    // 2. Create topics from interests
    const topicMap: Record<string, string> = {};
    for (const interest of interests) {
      const topicRes = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: interest, keywords: [interest], priority: "medium", digest_config_id: configId }),
      });
      const topic = await topicRes.json();
      topicMap[interest] = topic.id;
    }

    // 3. Create sources
    for (const source of sources) {
      await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: source.name,
          url: source.url,
          weight: source.weight,
          topic_id: source.interest ? topicMap[source.interest] || null : null,
          digest_config_id: configId,
        }),
      });
    }

    // 4. Create exclusions
    for (const keyword of exclusions) {
      await fetch("/api/exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, digest_config_id: configId }),
      });
    }

    return configId;
  }

  async function handleSaveOnly() {
    setSaving(true);
    try {
      await saveConfig();
      router.push("/");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndGenerate() {
    setGenerating(true);
    try {
      const configId = await saveConfig();

      // Trigger generation
      const genRes = await fetch("/api/digest/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestConfigId: configId }),
      });
      const { digestId } = await genRes.json();

      // Poll until complete
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((r) => setTimeout(r, 2000));
        const check = await fetch(`/api/digest/${digestId}`);
        const data = await check.json();
        if (data.status === "completed" || data.status === "failed") {
          setGeneratedDigest(data);
          break;
        }
        attempts++;
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Novo Digest</h1>
      </header>

      <WizardStepper currentStep={step} onStepClick={setStep} />

      <div className="mb-8">
        {step === 0 && (
          <StepInterests
            name={name} icon={icon} color={color} interests={interests}
            onNameChange={setName} onIconChange={setIcon} onColorChange={setColor} onInterestsChange={setInterests}
          />
        )}
        {step === 1 && (
          <StepSources interests={interests} sources={sources} onSourcesChange={setSources} />
        )}
        {step === 2 && (
          <StepPreferences
            language={language} summaryStyle={summaryStyle} digestTime={digestTime} maxArticles={maxArticles} exclusions={exclusions}
            onLanguageChange={setLanguage} onSummaryStyleChange={setSummaryStyle} onDigestTimeChange={setDigestTime} onMaxArticlesChange={setMaxArticles} onExclusionsChange={setExclusions}
          />
        )}
        {step === 3 && !generatedDigest && (
          <StepReview
            name={name} icon={icon} color={color} interests={interests} sources={sources}
            language={language} summaryStyle={summaryStyle} digestTime={digestTime} maxArticles={maxArticles} exclusions={exclusions}
          />
        )}
        {step === 3 && generatedDigest && (
          <div className="max-w-xl mx-auto text-center">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-xl font-bold mb-2">Digest gerado com sucesso!</h2>
            <p className="text-text-secondary mb-2">
              {generatedDigest.articles?.length || 0} artigos encontrados
            </p>
            {generatedDigest.summary && (
              <p className="text-sm text-text-muted mb-6">{generatedDigest.summary}</p>
            )}
            <Button onClick={() => router.push("/")}>Ver meu digest</Button>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      {!(step === 3 && generatedDigest) && (
        <div className="flex justify-between max-w-xl mx-auto">
          <Button variant="ghost" onClick={() => step > 0 ? setStep(step - 1) : router.push("/")} >
            {step === 0 ? "Cancelar" : "Voltar"}
          </Button>
          <div className="flex gap-2">
            {step < 3 && (
              <Button onClick={() => setStep(step + 1)} disabled={!canProceed[step]}>
                Proximo
              </Button>
            )}
            {step === 3 && !generatedDigest && (
              <>
                <Button variant="outline" onClick={handleSaveOnly} loading={saving}>
                  Salvar sem gerar
                </Button>
                <Button onClick={handleSaveAndGenerate} loading={generating}>
                  {generating ? "Gerando..." : "Gerar primeiro digest"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the wizard page renders**

```bash
cd "C:/Users/Gabriel/Documents/GitHub/jay-news" && npx next build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/wizard/page.tsx
git commit -m "feat: add wizard page orchestrating all creation steps"
```

---

## Task 11: DigestTabs Component

**Files:**
- Create: `src/components/feed/DigestTabs.tsx`

- [ ] **Step 1: Create the tab bar**

```typescript
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
    <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-4 scrollbar-hide">
      {configs.map((config) => (
        <button
          key={config.id}
          onClick={() => onSelect(config.id)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
            activeId === config.id
              ? "text-white"
              : "text-text-secondary hover:text-text hover:bg-surface-light"
          }`}
          style={activeId === config.id ? { backgroundColor: config.color } : undefined}
        >
          <span>{config.icon}</span>
          <span>{config.name}</span>
        </button>
      ))}
      <button
        onClick={() => router.push("/wizard")}
        className="flex items-center px-3 py-2 rounded-md text-sm text-text-muted hover:text-text hover:bg-surface-light transition-all"
      >
        +
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/feed/DigestTabs.tsx
git commit -m "feat: add DigestTabs component for multi-digest navigation"
```

---

## Task 12: Update Main Feed Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Rewrite page to support multi-digest**

Replace the entire content of `src/app/page.tsx` with:

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DigestTabs } from "@/components/feed/DigestTabs";
import { DaySummary } from "@/components/digest/DaySummary";
import { HighlightCards } from "@/components/digest/HighlightCards";
import { CategorySection } from "@/components/digest/CategorySection";
import { AlertsSection } from "@/components/digest/AlertsSection";
import { DigestDateSelector } from "@/components/digest/DigestDateSelector";
import type { Digest, DigestConfig, DigestWithArticles, Topic } from "@/types";

export default function FeedPage() {
  const [configs, setConfigs] = useState<DigestConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [digests, setDigests] = useState<Digest[]>([]);
  const [current, setCurrent] = useState<DigestWithArticles | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load configs on mount
  useEffect(() => {
    async function loadConfigs() {
      const res = await fetch("/api/digest-configs");
      const data: DigestConfig[] = await res.json();
      setConfigs(data);
      if (data.length === 0) {
        router.push("/wizard");
        return;
      }
      setActiveConfigId(data[0].id);
      setLoading(false);
    }
    loadConfigs();
  }, [router]);

  // Load digests when active config changes
  const loadDigestsForConfig = useCallback(async (configId: string) => {
    const [digestsRes, topicsRes] = await Promise.all([
      fetch(`/api/digests?limit=10&digestConfigId=${configId}`).then((r) => r.json()),
      fetch(`/api/topics?digestConfigId=${configId}`).then((r) => r.json()),
    ]);
    setDigests(digestsRes);
    setTopics(topicsRes);
    if (digestsRes.length > 0) {
      const res = await fetch(`/api/digest/${digestsRes[0].id}`);
      setCurrent(await res.json());
    } else {
      setCurrent(null);
    }
  }, []);

  useEffect(() => {
    if (activeConfigId) loadDigestsForConfig(activeConfigId);
  }, [activeConfigId, loadDigestsForConfig]);

  async function handleGenerate() {
    if (!activeConfigId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/digest/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestConfigId: activeConfigId }),
      });
      const { digestId } = await res.json();
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((r) => setTimeout(r, 2000));
        const check = await fetch(`/api/digest/${digestId}`);
        const data = await check.json();
        if (data.status === "completed" || data.status === "failed") {
          await loadDigestsForConfig(activeConfigId);
          break;
        }
        attempts++;
      }
    } finally {
      setGenerating(false);
    }
  }

  function handleSelectConfig(id: string) {
    setActiveConfigId(id);
    setCurrent(null);
  }

  const loadDigest = useCallback(async (id: string) => {
    const res = await fetch(`/api/digest/${id}`);
    setCurrent(await res.json());
  }, []);

  const getTopicName = (topicId: string) =>
    topics.find((t) => t.id === topicId)?.name || "Outros";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">JNews</h1>
          {current && (
            <p className="text-text-secondary text-sm">
              Digest de {new Date(current.generated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerate} loading={generating}>
            {generating ? "Gerando..." : "Gerar Digest"}
          </Button>
          <Button variant="ghost" onClick={() => router.push(`/settings?configId=${activeConfigId}`)}>
            ⚙
          </Button>
        </div>
      </header>

      <DigestTabs configs={configs} activeId={activeConfigId} onSelect={handleSelectConfig} />

      <DigestDateSelector digests={digests} selectedId={current?.id || null} onSelect={loadDigest} />

      {!current && digests.length === 0 && (
        <div className="text-center py-20">
          <p className="text-text-secondary text-lg mb-4">Nenhum digest gerado ainda.</p>
          <p className="text-text-muted text-sm mb-6">Clique em &quot;Gerar Digest&quot; para criar o primeiro.</p>
        </div>
      )}

      {current && (
        <div className="flex flex-col gap-6 mt-6">
          <DaySummary summary={current.summary} />
          <HighlightCards articles={current.highlights} />
          {Object.entries(current.by_topic)
            .filter(([key]) => key !== "uncategorized")
            .map(([topicId, articles]) => (
              <CategorySection key={topicId} name={getTopicName(topicId)} articles={articles} />
            ))}
          {current.by_topic["uncategorized"] && (
            <CategorySection name="Outros" articles={current.by_topic["uncategorized"]} />
          )}
          <AlertsSection articles={current.alert_articles} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd "C:/Users/Gabriel/Documents/GitHub/jay-news" && npx next build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: update feed page with digest tabs and multi-config support"
```

---

## Task 13: Update Settings Page

**Files:**
- Modify: `src/app/settings/page.tsx`
- Modify: `src/components/settings/SourcesList.tsx`
- Modify: `src/components/settings/SourceModal.tsx`

- [ ] **Step 1: Update settings page to scope by configId**

Replace the full content of `src/app/settings/page.tsx`:

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TopicsList } from "@/components/settings/TopicsList";
import { SourcesList } from "@/components/settings/SourcesList";
import { AlertsList } from "@/components/settings/AlertsList";
import { AdvancedOptions } from "@/components/settings/AdvancedOptions";
import { Modal } from "@/components/ui/Modal";
import type { Topic, RssSource, Alert, Exclusion, DigestConfig } from "@/types";

export default function SettingsPage() {
  const [config, setConfig] = useState<DigestConfig | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sources, setSources] = useState<RssSource[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const configId = searchParams.get("configId");

  const loadData = useCallback(async () => {
    if (!configId) return;

    const [configsRes, topicsRes, sourcesRes, alertsRes, exclusionsRes] = await Promise.all([
      fetch("/api/digest-configs").then((r) => r.json()),
      fetch(`/api/topics?digestConfigId=${configId}`).then((r) => r.json()),
      fetch(`/api/sources?digestConfigId=${configId}`).then((r) => r.json()),
      fetch(`/api/alerts?digestConfigId=${configId}`).then((r) => r.json()),
      fetch(`/api/exclusions?digestConfigId=${configId}`).then((r) => r.json()),
    ]);

    const activeConfig = configsRes.find((c: DigestConfig) => c.id === configId);
    setConfig(activeConfig || null);
    setTopics(topicsRes);
    setSources(sourcesRes);
    setAlerts(alertsRes);
    setExclusions(exclusionsRes);
    setLoading(false);
  }, [configId]);

  useEffect(() => {
    if (!configId) {
      router.push("/");
      return;
    }
    loadData();
  }, [configId, loadData, router]);

  async function handleSettingsChange(updates: Partial<DigestConfig>) {
    if (!config) return;
    const updated = { ...config, ...updates };
    setConfig(updated);
    await fetch("/api/digest-configs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: config.id, ...updates }),
    });
  }

  async function handleAddExclusion(keyword: string) {
    await fetch("/api/exclusions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, digest_config_id: configId }),
    });
    loadData();
  }

  async function handleRemoveExclusion(id: string) {
    await fetch(`/api/exclusions?id=${id}`, { method: "DELETE" });
    loadData();
  }

  async function handleDeleteConfig() {
    await fetch(`/api/digest-configs?id=${configId}`, { method: "DELETE" });
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          {config && <span className="text-2xl">{config.icon}</span>}
          <h1 className="text-2xl font-bold">{config?.name || "Configuracoes"}</h1>
        </div>
        <Button variant="outline" onClick={() => router.push("/")}>
          Voltar
        </Button>
      </header>
      <div className="flex flex-col gap-6">
        <TopicsList topics={topics} onRefresh={loadData} configId={configId!} />
        <SourcesList sources={sources} topics={topics} onRefresh={loadData} configId={configId!} />
        <AlertsList alerts={alerts} onRefresh={loadData} configId={configId!} />
        <AdvancedOptions
          settings={config ? {
            user_id: config.user_id,
            digest_time: config.digest_time,
            language: config.language,
            summary_style: config.summary_style as "executive" | "detailed",
            max_articles: config.max_articles,
            created_at: config.created_at,
            updated_at: config.updated_at,
          } : undefined as any}
          exclusions={exclusions}
          onSettingsChange={(updates) => handleSettingsChange(updates as Partial<DigestConfig>)}
          onAddExclusion={handleAddExclusion}
          onRemoveExclusion={handleRemoveExclusion}
        />

        <div className="border-t border-border pt-6">
          <Button variant="ghost" className="text-danger" onClick={() => setDeleteModalOpen(true)}>
            Deletar este digest
          </Button>
        </div>
      </div>

      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Deletar Digest">
        <p className="text-text-secondary mb-4">
          Tem certeza que deseja deletar &quot;{config?.name}&quot;? Isso ira remover todas as fontes, temas e alertas associados.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
          <Button className="bg-danger hover:bg-danger/80" onClick={handleDeleteConfig}>Deletar</Button>
        </div>
      </Modal>
    </div>
  );
}
```

Note: The `TopicsList`, `SourcesList`, and `AlertsList` components will need a `configId` prop to pass `digest_config_id` when creating new items. Update their interfaces to accept and use it in their save handlers.

- [ ] **Step 2: Update SourcesList to show weight and test button**

In `src/components/settings/SourcesList.tsx`:
- Import `WeightStars` from wizard components
- Display weight stars in each source row
- Add a "Testar" button per source that calls `/api/sources/test`
- Show test result inline

- [ ] **Step 3: Update SourceModal to include weight field**

In `src/components/settings/SourceModal.tsx`:
- Add `weight` state (default 3)
- Add `WeightStars` component in the form
- Include `weight` in the `onSave` callback data
- Include `digest_config_id` in the save data

- [ ] **Step 4: Verify build**

```bash
cd "C:/Users/Gabriel/Documents/GitHub/jay-news" && npx next build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/page.tsx src/components/settings/SourcesList.tsx src/components/settings/SourceModal.tsx
git commit -m "feat: update settings page for multi-digest with weights and source testing"
```

---

## Task 14: Manual Testing

- [ ] **Step 1: Start dev server**

```bash
cd "C:/Users/Gabriel/Documents/GitHub/jay-news" && npm run dev
```

- [ ] **Step 2: Test wizard flow**

1. Navigate to `http://localhost:3000`
2. Should redirect to `/wizard` (no configs yet, or clear existing ones)
3. Step 1: Enter name, pick emoji/color, add 2-3 interests
4. Step 2: Add at least 1 RSS source, test it, set weight
5. Step 3: Verify defaults, add an exclusion
6. Step 4: Review, click "Gerar primeiro digest"
7. Wait for generation, verify success
8. Click "Ver meu digest" — should show feed with tab

- [ ] **Step 3: Test multi-digest**

1. Click "+" tab to create second digest
2. Complete wizard with different name/interests
3. Verify both tabs appear on feed page
4. Switch between tabs — digests should be independent

- [ ] **Step 4: Test settings**

1. Click gear icon — should go to settings scoped to active config
2. Verify sources show weight stars
3. Test a source from settings
4. Edit source weight
5. Go back — verify changes persisted

- [ ] **Step 5: Test source testing edge cases**

1. Test invalid URL (not RSS)
2. Test unreachable URL
3. Test valid RSS feed
4. Verify appropriate error messages

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: Phase 1 complete — multi-digest wizard with source testing and weights"
```
