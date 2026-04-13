# Phase 1 Design Spec: Wizard + Source Testing + Weights + Multi-Digest

**Date:** 2026-04-12
**Status:** Approved

## Overview

Transform jay-news from a single-digest-per-user app into a multi-digest platform where each user can create multiple independent news digests, each with its own topics, sources, alerts, and preferences. A step-by-step Wizard guides creation of each digest. Sources can be tested inline and assigned weights that influence article selection.

## 1. Data Model Changes

### 1.1 New Table: `digest_configs`

Central entity linking a user to a named digest configuration.

```sql
CREATE TABLE digest_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,            -- "Trading", "Tech News"
  icon TEXT DEFAULT '📰',        -- emoji identifier
  color TEXT DEFAULT '#fb830e',  -- tab accent color
  language TEXT NOT NULL DEFAULT 'pt-BR',
  summary_style TEXT NOT NULL DEFAULT 'executive' CHECK (summary_style IN ('executive', 'detailed')),
  digest_time TIME NOT NULL DEFAULT '07:00',
  max_articles INTEGER NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_digest_configs_user ON digest_configs(user_id);
```

### 1.2 Modified Tables

Add `digest_config_id` to all config-related tables. Keep `user_id` for RLS.

**topics** — add column:
```sql
ALTER TABLE topics ADD COLUMN digest_config_id UUID REFERENCES digest_configs(id) ON DELETE CASCADE;
```

**rss_sources** — add columns:
```sql
ALTER TABLE rss_sources ADD COLUMN digest_config_id UUID REFERENCES digest_configs(id) ON DELETE CASCADE;
ALTER TABLE rss_sources ADD COLUMN weight INTEGER NOT NULL DEFAULT 3 CHECK (weight >= 1 AND weight <= 5);
```

**alerts** — add column:
```sql
ALTER TABLE alerts ADD COLUMN digest_config_id UUID REFERENCES digest_configs(id) ON DELETE CASCADE;
```

**exclusions** — add column:
```sql
ALTER TABLE exclusions ADD COLUMN digest_config_id UUID REFERENCES digest_configs(id) ON DELETE CASCADE;
```

**digests** — add column:
```sql
ALTER TABLE digests ADD COLUMN digest_config_id UUID REFERENCES digest_configs(id) ON DELETE SET NULL;
```

### 1.3 Indexes on `digest_config_id`

```sql
CREATE INDEX idx_topics_config ON topics(digest_config_id);
CREATE INDEX idx_rss_sources_config ON rss_sources(digest_config_id);
CREATE INDEX idx_alerts_config ON alerts(digest_config_id);
CREATE INDEX idx_exclusions_config ON exclusions(digest_config_id);
CREATE INDEX idx_digests_config ON digests(digest_config_id);
```

### 1.4 Data Migration

For existing users, create a default `digest_config` from their `user_settings` and link all existing data. Handles edge case of users who have data but no `user_settings` row.

```sql
-- Ensure all users with data have a user_settings row (fill gaps with defaults)
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

-- Create default digest_config from user_settings
INSERT INTO digest_configs (user_id, name, icon, language, summary_style, digest_time, max_articles)
SELECT user_id, 'Meu Digest', '📰', language, summary_style, digest_time, max_articles
FROM user_settings;

-- Link existing records (ORDER BY ensures determinism)
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
```

After migration, `digest_config_id` becomes NOT NULL on topics, rss_sources, alerts, exclusions. The `digests` table keeps it nullable (ON DELETE SET NULL) to preserve historical digest records if a config is deleted.

### 1.5 `user_settings` Deprecation

`user_settings` is kept for now as a fallback but is no longer the source of truth for digest-specific settings. All per-digest settings live in `digest_configs`. The `handle_new_user` trigger remains (creates `user_settings` on signup), but the app redirects new users to the Wizard to create their first `digest_config`. The cron path skips users with zero active configs. `user_settings` can be fully removed in a future phase once all users have migrated.

Note: `rss_sources.topic_id` is retained — it links a source to a specific topic within its digest config. The wizard UI organizes sources by topic, and "Fontes gerais" uses `topic_id = NULL`.

### 1.6 RLS for digest_configs

```sql
ALTER TABLE digest_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own configs" ON digest_configs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own configs" ON digest_configs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own configs" ON digest_configs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own configs" ON digest_configs FOR DELETE USING (user_id = auth.uid());
```

### 1.7 Updated TypeScript Types

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

// Existing interfaces gain digest_config_id:
export interface Topic {
  // ... existing fields ...
  digest_config_id: string;
}

export interface RssSource {
  // ... existing fields ...
  digest_config_id: string;
  weight: number; // 1-5
}

export interface Alert {
  // ... existing fields ...
  digest_config_id: string;
}

export interface Exclusion {
  // ... existing fields ...
  digest_config_id: string;
}

export interface Digest {
  // ... existing fields ...
  digest_config_id: string | null;
}
```

## 2. Source Testing Endpoint

### `POST /api/sources/test`

**Request:**
```json
{ "url": "https://example.com/feed.xml" }
```

**Response (success):**
```json
{
  "status": "success",
  "feed_name": "TechCrunch",
  "total_articles": 20,
  "sample_articles": [
    {
      "title": "AI Startup Raises $50M",
      "published_at": "2026-04-12T10:00:00Z",
      "url": "https://..."
    },
    {
      "title": "New Framework Released",
      "published_at": "2026-04-12T08:00:00Z",
      "url": "https://..."
    }
  ]
}
```

**Response (error):**
```json
{
  "status": "error",
  "error_code": "INVALID_RSS",
  "error_message": "URL is not a valid RSS/Atom feed"
}
```

Error codes: `INVALID_URL`, `UNREACHABLE`, `INVALID_RSS`, `TIMEOUT`, `EMPTY_FEED`.

Implementation: uses the existing `rss-parser` library, no auth required beyond user session. Does NOT persist anything — purely a validation endpoint.

## 3. Weight System

### How weights affect the pipeline

In `generator.ts`, when capping RSS articles per source:

```
cap_per_source = weight * 2
```

| Weight | Stars | Cap | Meaning |
|--------|-------|-----|---------|
| 1 | * | 2 | Minimal |
| 2 | ** | 4 | Low |
| 3 | *** | 6 | Normal (default) |
| 4 | **** | 8 | High |
| 5 | ***** | 10 | Maximum |

After Claude scores articles, apply a relevance boost (clamped to [0, 1]):

```
final_score = Math.min(1.0, relevance_score * (1 + (weight - 3) * 0.1))
```

This gives weight-5 sources a +20% boost and weight-1 sources a -20% penalty, which influences ranking without completely overriding Claude's relevance assessment. Scores are clamped to 1.0 maximum to preserve the normalized scale.

## 4. Wizard UI

### 4.1 Route

`/wizard` — fullscreen page, no sidebar/header from main app.

### 4.2 Stepper Component

Horizontal progress bar at the top with 4 labeled steps:
1. Interesses
2. Fontes
3. Preferencias
4. Revisao

Active step highlighted in primary color. Completed steps show checkmark. Steps are clickable to navigate back (but not forward past current).

### 4.3 Step 1 — Interesses (Interests)

- Text input for digest name (required, placeholder: "Ex: Trading, Tech News")
- Emoji picker (grid of common emojis, default "📰")
- Color picker (6 preset colors matching the design system)
- ChipInput for interests (placeholder: "Digite um interesse e pressione Enter")
  - Each chip = one interest that will become a Topic
  - Examples shown as placeholder text: "empreendedorismo, IA, day trade..."
- Minimum 1 interest required to proceed

### 4.4 Step 2 — Fontes (Sources)

Layout: interests from Step 1 shown as collapsible sections. Each section has:
- Section header: interest name + article count badge
- "Adicionar fonte" button that reveals:
  - URL input + "Testar" button (inline)
  - On test success: preview card appears (feed name, article count, 2 sample articles)
  - Name field (auto-filled from feed title, editable)
  - Weight slider (1-5 stars, default 3)
  - "Confirmar" button to add to the list

Below all interest sections, a "Fontes gerais" section for sources not tied to any interest.

Sources are held in local state until wizard completion — nothing is persisted mid-wizard.

### 4.5 Step 3 — Preferencias (Preferences)

- Language select (pt-BR, English, Espanol)
- Summary style (Executivo: 2-3 frases / Detalhado: 4-5 frases)
- Digest time (time picker, default 07:00)
- Max articles (number input, 5-50, default 20)
- Exclusions (ChipInput for keywords to filter out)

### 4.6 Step 4 — Revisao + Gerar (Review + Generate)

Summary cards:
- **Digest info:** name, icon, color
- **Interesses:** list with keyword count
- **Fontes:** list with test status badge (green/red) and weight stars
- **Preferencias:** language, style, time, max articles, exclusions

Two action buttons:
- "Gerar primeiro digest" (primary) — saves all config to DB, triggers digest generation, shows inline loading then result
- "Salvar sem gerar" (secondary) — saves config only, redirects to main feed

On "Gerar primeiro digest":
1. POST to `/api/digest-configs` to create the config
2. POST topics, sources, alerts, exclusions linked to new config
3. POST to `/api/digest/generate` with `digestConfigId`
4. Poll until complete, show result inline
5. "Tudo certo!" button → redirect to main feed with new tab selected

## 5. API Changes

### New Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/digest-configs` | List user's digest configs |
| POST | `/api/digest-configs` | Create new digest config |
| PUT | `/api/digest-configs` | Update digest config |
| DELETE | `/api/digest-configs?id=X` | Delete digest config and all linked data |
| POST | `/api/sources/test` | Test RSS URL (see section 2) |

### Modified Endpoints

All existing CRUD endpoints (`/api/topics`, `/api/sources`, `/api/alerts`, `/api/exclusions`) gain a required `digestConfigId` parameter:
- GET: filter by `digest_config_id`
- POST: include `digest_config_id` in insert
- PUT/DELETE: validate ownership via `digest_config_id`

`/api/digest/generate` accepts optional `digestConfigId` body parameter. If provided, generates for that specific config. If omitted, generates for all active configs (backward compat for cron).

`/api/digests` gains optional `digestConfigId` query param to filter.

## 6. Main Feed Changes

### Tab Bar

Below the header, horizontal scrollable tab bar:
- Each tab: `[emoji] [name]` with bottom border in config's `color`
- Active tab: filled background, bold text
- "+" tab at the end → navigates to `/wizard`
- If no configs exist → auto-redirect to `/wizard`

### Feed Content

When a tab is selected, load digests filtered by that `digest_config_id`. Everything else (DaySummary, HighlightCards, CategorySection, AlertsSection, DigestDateSelector) works the same but scoped to the selected config.

### Settings Access

The gear icon in the header now goes to `/settings?configId=X` (the currently selected tab's config). Settings page loads data filtered by that config.

## 7. Settings Page Changes

- Header shows digest name + emoji
- All lists (topics, sources, alerts, exclusions) filtered by `digest_config_id`
- Sources list gains weight column (star display + editable)
- Sources list gains "Testar" button per source (calls `/api/sources/test`)
- "Deletar digest" button at the bottom (with confirmation modal)
- Back button returns to feed with that tab selected

## 8. Generator Pipeline Changes

`generateDigest(userId, type)` becomes `generateDigest(userId, type, digestConfigId)`:

1. Load config from `digest_configs` instead of `user_settings`
2. Load topics/sources/alerts/exclusions filtered by `digest_config_id`
3. RSS cap per source: `source.weight * 2` instead of hard-coded 5
4. After Claude scoring, apply weight boost: `score * (1 + (weight - 3) * 0.1)`
5. Insert digest with `digest_config_id`

For cron/scheduled generation: query all active `digest_configs` across all users where `digest_time` matches the current hour. For each config, call `generateDigest(config.user_id, "scheduled", config.id)`. Skip users with zero active configs.

## 9. Files to Create/Modify

### New Files
- `supabase/migrations/002_multi_digest.sql` — schema changes + data migration
- `src/app/wizard/page.tsx` — wizard page (client component)
- `src/components/wizard/WizardStepper.tsx` — progress stepper
- `src/components/wizard/StepInterests.tsx` — step 1
- `src/components/wizard/StepSources.tsx` — step 2
- `src/components/wizard/StepPreferences.tsx` — step 3
- `src/components/wizard/StepReview.tsx` — step 4
- `src/components/wizard/SourceTestCard.tsx` — RSS test preview card
- `src/components/wizard/WeightStars.tsx` — 1-5 star weight selector
- `src/components/feed/DigestTabs.tsx` — tab bar for main feed
- `src/app/api/digest-configs/route.ts` — CRUD for digest configs
- `src/app/api/sources/test/route.ts` — RSS test endpoint

### Modified Files
- `src/types/index.ts` — add DigestConfig, update existing interfaces
- `src/app/page.tsx` — add tab bar, scope feed by config
- `src/app/settings/page.tsx` — scope by configId, add weight/test UI
- `src/lib/digest/generator.ts` — accept configId, weight-based caps/boost
- `src/app/api/topics/route.ts` — add digest_config_id filtering
- `src/app/api/sources/route.ts` — add digest_config_id filtering + weight
- `src/app/api/alerts/route.ts` — add digest_config_id filtering
- `src/app/api/exclusions/route.ts` — add digest_config_id filtering
- `src/app/api/digest/generate/route.ts` — accept configId param
- `src/app/api/digests/route.ts` — accept configId filter
- `src/components/settings/SourcesList.tsx` — add weight stars + test button
- `src/components/settings/SourceModal.tsx` — add weight field

## 10. Out of Scope (Future Phases)

- Fetch-all pipeline + 7-day storage (Phase 2)
- UI redesign (Phase 3)
- AI source suggestions (Phase 4)
- Trend tracking (Phase 4)
