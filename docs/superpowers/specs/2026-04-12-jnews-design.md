# JNews -- Personalized AI News Digest

**Date:** 2026-04-12
**Status:** Approved
**Author:** Gabriel + Claude

---

## 1. Overview

JNews is a personalized news digest app that fetches articles from multiple sources (RSS feeds + search API), processes them with Claude AI (summarization, classification, relevance scoring), and presents a curated daily digest. Users can configure topics, sources, alerts, and exclusions to tailor their news experience.

### Goals

- Daily automated digest with AI-curated summaries
- Highly configurable: topics, sources, alerts, exclusions, priorities
- On-demand generation for breaking news
- Clean, dark UI following Arena Design System

### Non-Goals

- Real-time push notifications (v1)
- Social features / sharing (v1)
- Mobile native app (web-responsive is enough)

---

## 2. Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (Postgres + Auth + RLS) |
| AI | Anthropic Claude API |
| News Sources | RSS (`rss-parser`) + Tavily Search API |
| Deploy | Vercel (frontend + API + cron) |
| Design | Arena Design System (dark theme, Sora/Inter, #fb830e) |

### System Diagram

```
┌─────────────────────────────────────────────────────┐
│                    VERCEL                            │
│                                                     │
│  ┌──────────────┐    ┌───────────────────────────┐  │
│  │  Next.js App │    │      API Routes           │  │
│  │              │    │                           │  │
│  │  /           │    │  /api/digest/generate     │  │
│  │  /settings   │    │  /api/digest/on-demand    │  │
│  │  /login      │    │  /api/sources/rss         │  │
│  │              │    │  /api/topics              │  │
│  │              │    │  /api/alerts              │  │
│  └──────┬───────┘    └─────────┬─────────────────┘  │
│         │                      │                    │
│  ┌──────┴──────────────────────┴──────────────────┐ │
│  │           Vercel Cron (daily 10:00 UTC)        │ │
│  │           → POST /api/digest/generate          │ │
│  └────────────────────────────────────────────────┘ │
└───────────────────────┬─────────────────────────────┘
                        │
          ┌─────────────┼──────────────┐
          │             │              │
          ▼             ▼              ▼
   ┌────────────┐ ┌──────────┐ ┌─────────────┐
   │  Supabase  │ │ Anthropic│ │   Tavily    │
   │  Postgres  │ │ Claude   │ │   Search    │
   │  + Auth    │ │ API      │ │ + RSS Feeds │
   └────────────┘ └──────────┘ └─────────────┘
```

### Approach: Pragmatic Monorepo

All logic lives in one Next.js repo. API routes handle both cron-triggered and on-demand digest generation. The same `/api/digest/generate` endpoint serves both triggers. If volume grows, API routes can be migrated to Supabase Edge Functions incrementally without touching the frontend.

### Timeout Strategy

Vercel function timeout: 10s (hobby) / 60s (pro). The digest generation step 4 (Claude processing) is the heaviest. Strategy: process articles in batches of ~10 per Claude API call. For 40 articles, that's ~4 sequential calls instead of one monolithic request. Each Claude call takes ~3-5s, so a full generation (~20s total) fits within the Pro tier timeout. For hobby tier, consider reducing batch size or upgrading.

### Cron Strategy (Single-User v1)

In v1 this is a single-user app. The Vercel Cron fires once daily and generates the digest for that user. The `user_settings.digest_time` field exists for future multi-user support but is not used by the cron in v1 -- the cron always runs at 10:00 UTC (7:00 BRT). When multi-user is needed, the cron would query all users grouped by `digest_time` and generate digests accordingly.

---

## 3. Data Model

### Tables

```sql
-- User settings (1:1 with auth.users)
user_settings (
  user_id         uuid PK FK → auth.users
  digest_time     time DEFAULT '07:00'
  language        text DEFAULT 'pt-BR'
  summary_style   text DEFAULT 'executive'  -- 'executive' | 'detailed'
  max_articles    int  DEFAULT 20
  created_at      timestamptz DEFAULT now()
  updated_at      timestamptz DEFAULT now()
)
-- RLS: user_id = auth.uid()

-- Topics the user wants to follow
topics (
  id              uuid PK DEFAULT gen_random_uuid()
  user_id         uuid FK → auth.users NOT NULL
  name            text NOT NULL
  keywords        text[] NOT NULL
  priority        text DEFAULT 'medium'  -- 'high' | 'medium' | 'low'
  is_active       boolean DEFAULT true
  created_at      timestamptz DEFAULT now()
)

-- RSS feed sources
rss_sources (
  id              uuid PK DEFAULT gen_random_uuid()
  user_id         uuid FK → auth.users NOT NULL
  name            text NOT NULL
  url             text NOT NULL
  topic_id        uuid FK → topics (nullable)
  is_active       boolean DEFAULT true
  created_at      timestamptz DEFAULT now()
)

-- Alerts for specific news/events to follow
alerts (
  id              uuid PK DEFAULT gen_random_uuid()
  user_id         uuid FK → auth.users NOT NULL
  title           text NOT NULL
  query           text NOT NULL
  is_active       boolean DEFAULT true
  expires_at      timestamptz (nullable)
  created_at      timestamptz DEFAULT now()
)

-- Exclusion filters
exclusions (
  id              uuid PK DEFAULT gen_random_uuid()
  user_id         uuid FK → auth.users NOT NULL
  keyword         text NOT NULL
  is_active       boolean DEFAULT true
  created_at      timestamptz DEFAULT now()
)

-- Generated digests
digests (
  id              uuid PK DEFAULT gen_random_uuid()
  user_id         uuid FK → auth.users NOT NULL
  generated_at    timestamptz DEFAULT now()
  type            text NOT NULL  -- 'scheduled' | 'on_demand'
  status          text DEFAULT 'processing'  -- 'processing' | 'completed' | 'failed'
  summary         text (nullable)
  metadata        jsonb DEFAULT '{}'
)

-- Individual articles within a digest
articles (
  id              uuid PK DEFAULT gen_random_uuid()
  digest_id       uuid FK → digests NOT NULL
  topic_id        uuid FK → topics (nullable)
  alert_id        uuid FK → alerts (nullable)
  title           text NOT NULL
  source_name     text NOT NULL
  source_url      text NOT NULL
  summary         text NOT NULL
  relevance_score float NOT NULL  -- 0.0 to 1.0
  is_highlight    boolean DEFAULT false
  image_url       text (nullable)
  published_at    timestamptz (nullable)
  created_at      timestamptz DEFAULT now()
)
```

### Row Level Security

All tables enforce `user_id = auth.uid()` via RLS policies. Each user can only read/write their own data.

### Indexes

- `articles(digest_id)` -- fast lookup by digest
- `articles(relevance_score DESC)` -- fast sorting for highlights
- `digests(user_id, generated_at DESC)` -- fast digest history
- `topics(user_id)` -- fast settings load

---

## 4. Digest Generation Flow

### Trigger

- **Scheduled:** Vercel Cron at 10:00 UTC (7:00 BRT) → `POST /api/digest/generate`
- **On-demand:** User clicks "Gerar" button → `POST /api/digest/generate`

### Steps

1. **Load user config** -- topics, rss_sources, alerts, exclusions, settings from Supabase
2. **Fetch articles in parallel:**
   - **2a. RSS:** For each active `rss_source`, fetch and parse the feed
   - **2b. Search:** For each active `topic` + `alert`, query Tavily Search API
3. **Filter** -- Remove articles matching `exclusions` keywords, deduplicate by URL and title similarity
4. **Process with Claude** -- In batches of ~10 articles:
   - Summarize each article (respecting `summary_style` and `language`)
   - Classify into matching `topic`
   - Score relevance 0-1 based on user's topic priorities
   - Mark top 3 by score as `is_highlight = true`
5. **Save** -- Create `digest` record, insert all `articles`, generate day summary via one final Claude call

### Claude Prompts

**Batch processing prompt (step 4):**
Receives: raw articles + user topics/priorities + language/style settings.
Returns: JSON array with `{ summary, topic_id, relevance_score }` per article.

**Day summary prompt (step 5):**
Receives: all processed articles for the digest.
Returns: 2-3 sentence overview of the day's news landscape.

### Error Handling

- If RSS fetch fails for one source: skip it, continue with others
- If Tavily fails: skip search results, continue with RSS only
- If Claude batch fails: retry once, then mark those articles as unprocessed
- If entire generation fails: set digest `status = 'failed'`, surface error to user

---

## 5. UI Design

### Design System (Arena)

| Token | Value |
|-------|-------|
| Background | `#151515` |
| Card background | `rgba(28, 29, 30, 0.8)` |
| Primary color | `#fb830e` (orange) |
| Primary hover | `#fba24b` |
| Secondary color | `#08a6ff` (blue) |
| Error/danger | `#f54336` |
| Success | `#75f94c` |
| Text primary | `#ffffff` |
| Text secondary | `#828282` |
| Border radius | `12px` |
| Font heading | Sora |
| Font body | Inter |
| Header gradient | `linear-gradient(46.67deg, #ee322f -21.02%, #fee53a 108.85%)` |

### Screen 1: News Feed (`/`)

**Layout:**
- Header: "JNews" logo + "Gerar" button (primary orange) + settings icon
- Day summary: card with 2-3 sentence AI overview
- Highlights: 3 cards in row (first larger) with image, title, summary, source, topic tag
- Category sections: collapsible, grouped by topic, articles as rows with title + summary + source + time
- Alerts section: only shown if active alerts have results, orange accent border

**Interactions:**
- "Gerar" button: triggers on-demand generation, shows loading spinner, refreshes on completion
- Article click: opens original source URL in new tab
- Date selector: browse previous digests
- Category sections: collapsible via click on header

### Screen 2: Settings (`/settings`)

**Layout:**
- Topics section: list with name, keywords, priority badge, edit/delete. "+ Novo" button opens modal.
- RSS Sources section: list with name, associated topic, edit/delete. "+ Novo" validates RSS URL.
- Alerts section: list with title, query, expiry date, edit/delete.
- "Opcoes avancadas" expandable section: digest time, language, summary style, max articles, exclusion chips.

**Interactions:**
- All CRUD operations: inline with modal for create/edit
- Priority badges: color-coded (orange=high, blue=medium, gray=low)
- RSS URL: validated on add (attempts to parse feed)
- Exclusions: chip input (type + enter to add, x to remove)
- All changes save immediately (optimistic UI)

### Screen 3: Login (`/login`)

- Minimal: email + password form, "Entrar" button, "Criar conta" link
- Arena dark theme, centered card
- Supabase Auth handles the flow

---

## 6. Project Structure

```
jay-news/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    -- feed (/)
│   │   ├── settings/page.tsx           -- settings (/settings)
│   │   ├── login/page.tsx              -- login (/login)
│   │   └── api/
│   │       ├── digest/
│   │       │   ├── generate/route.ts
│   │       │   └── [id]/route.ts
│   │       ├── digests/route.ts            -- GET list (history)
│   │       ├── topics/route.ts
│   │       ├── sources/route.ts
│   │       ├── alerts/route.ts
│   │       ├── exclusions/route.ts
│   │       └── auth/callback/route.ts
│   ├── components/
│   │   ├── ui/                         -- Button, Card, Input, Modal, Chip, etc.
│   │   ├── digest/
│   │   │   ├── HighlightCards.tsx
│   │   │   ├── CategorySection.tsx
│   │   │   ├── ArticleRow.tsx
│   │   │   ├── AlertsSection.tsx
│   │   │   └── DaySummary.tsx
│   │   └── settings/
│   │       ├── TopicsList.tsx
│   │       ├── SourcesList.tsx
│   │       ├── AlertsList.tsx
│   │       └── AdvancedOptions.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── anthropic/
│   │   │   ├── client.ts
│   │   │   └── prompts.ts
│   │   ├── sources/
│   │   │   ├── rss.ts
│   │   │   └── search.ts
│   │   └── digest/
│   │       ├── generator.ts
│   │       ├── filter.ts
│   │       └── processor.ts
│   ├── types/index.ts
│   └── styles/globals.css
├── supabase/migrations/
├── public/
├── vercel.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.local
```

### Dependencies

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "@supabase/supabase-js": "^2",
    "@supabase/ssr": "^0",
    "@anthropic-ai/sdk": "^0",
    "rss-parser": "^3",
    "tailwindcss": "^4",
    "tailwind-merge": "^2",
    "clsx": "^2"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/react": "^19",
    "@types/node": "^22"
  }
}
```

### Environment Variables (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://upespttemmhrewszxjet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
ANTHROPIC_API_KEY=<anthropic key>
TAVILY_API_KEY=<tavily key>
CRON_SECRET=<random secret for cron auth>
```

### Vercel Cron Config

```json
// vercel.json
{
  "crons": [{
    "path": "/api/digest/generate",
    "schedule": "0 10 * * *"
  }]
}
```

The cron endpoint validates `CRON_SECRET` via the `Authorization` header (Vercel injects this automatically).

---

## 7. API Routes

### POST /api/digest/generate

- **Auth:** Cron secret (scheduled) or user JWT (on-demand)
- **Body (on-demand):** `{ userId?: string }` (defaults to authenticated user)
- **Flow:** Runs full digest generation pipeline (section 4)
- **Response:** `{ digestId: string, status: 'processing' }`

### GET /api/digest/[id]

- **Auth:** User JWT
- **Response:** Full digest with all articles, grouped by topic

### CRUD /api/topics

- **GET:** List user's topics
- **POST:** Create topic `{ name, keywords, priority }`
- **PUT:** Update topic
- **DELETE:** Soft-delete (set `is_active = false`)

### CRUD /api/sources

- **GET:** List user's RSS sources
- **POST:** Create source `{ name, url, topicId? }` (validates RSS URL)
- **PUT:** Update source
- **DELETE:** Soft-delete

### CRUD /api/alerts

- **GET:** List user's alerts
- **POST:** Create alert `{ title, query, expiresAt? }`
- **PUT:** Update alert
- **DELETE:** Soft-delete

### CRUD /api/exclusions

- **GET:** List user's exclusions
- **POST:** Create exclusion `{ keyword }`
- **DELETE:** Soft-delete (set `is_active = false`)

### GET /api/digests

- **Auth:** User JWT
- **Query params:** `?limit=10&offset=0`
- **Response:** List of digests `[{ id, generated_at, type, status, summary }]` ordered by `generated_at DESC`. Used by the date selector on the feed page to browse previous digests.

### GET /api/auth/callback

- Handles Supabase Auth redirect after login/signup

---

## 8. Security

- All API routes validate JWT via Supabase middleware (except cron endpoint which validates `CRON_SECRET`)
- RLS on all Supabase tables ensures data isolation per user
- API keys (Anthropic, Tavily) stored as server-side env vars, never exposed to client
- CRUD operations validate ownership before mutations
- RSS URL validation prevents SSRF: only allow `http://` and `https://` schemes, reject private/reserved IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, localhost), validate URL parses correctly before fetching
