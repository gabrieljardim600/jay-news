# Trading Broadcast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Trading" tab to JNews with morning + closing market briefs for day traders of mini contracts (WINFUT/WDOFUT), covering global/BR macro, economic calendar, sentiment indicators, and contextual Claude analysis.

**Architecture:** New `digest_type: "trading"` reuses the existing digest pipeline (collect → enrich → Claude → save). A dedicated cron route triggers two daily editions (morning 06:30 BRT, closing 18:00 BRT). The frontend renders a panel-style layout (not a linear feed) with structured sections. Data sources are hardcoded Tavily queries + financial RSS feeds.

**Tech Stack:** Next.js App Router, Supabase (existing tables + new `trading_edition` field), Tavily API, Claude Sonnet, Tailwind CSS, Lucide icons.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/trading/sources.ts` | Create | Hardcoded queries, RSS feeds, calendar events |
| `src/lib/trading/collector.ts` | Create | Fetch all trading data (Tavily + RSS + sentiment scrape) |
| `src/lib/trading/prompt.ts` | Create | Morning + closing Claude prompts, output schema |
| `src/lib/trading/generator.ts` | Create | Full pipeline: collect → synthesize → save |
| `src/lib/trading/types.ts` | Create | TradingBrief, TradingSection, SentimentData types |
| `src/app/api/cron/trading-broadcast/route.ts` | Create | Cron endpoint (morning/closing) |
| `src/app/api/trading/route.ts` | Create | GET list briefs, POST generate on-demand |
| `src/app/api/trading/[id]/route.ts` | Create | GET single brief detail |
| `src/app/trading/page.tsx` | Create | Trading tab page |
| `src/app/trading/loading.tsx` | Create | Skeleton |
| `src/components/trading/TradingPanel.tsx` | Create | Main panel layout (sections grid) |
| `src/components/trading/SentimentCard.tsx` | Create | Fear&Greed + VIX + put/call display |
| `src/components/trading/AgendaTable.tsx` | Create | Economic calendar table |
| `src/components/trading/BulletSection.tsx` | Create | Reusable bullet-list section card |
| `src/components/trading/TradingDateNav.tsx` | Create | Date selector + Morning/Closing toggle |
| `src/components/trading/TradingSkeleton.tsx` | Create | Loading skeleton |
| `src/components/ui/ModeNav.tsx` | Modify | Add Trading tab |
| `src/components/onboarding/steps.ts` | Modify | Add Trading onboarding step |
| `vercel.json` | Modify | Add 2 cron schedules |

---

### Task 1: Types + data sources

**Files:**
- Create: `src/lib/trading/types.ts`
- Create: `src/lib/trading/sources.ts`

- [ ] **Step 1: Create types**

```ts
// src/lib/trading/types.ts
export type TradingEdition = "morning" | "closing";

export type AgendaEvent = {
  time: string;        // "09:00" or "all-day"
  event: string;
  impact: "alto" | "medio";
  region: "BR" | "EUA" | "Global";
};

export type SentimentData = {
  fear_greed: number | null;   // 0-100
  fear_greed_label: string | null;
  vix: number | null;
  put_call: number | null;
  summary: string;             // Claude paragraph
};

export type TradingBrief = {
  id: string;
  user_id: string;
  edition: TradingEdition;
  date: string;                // YYYY-MM-DD
  global_bullets: string[];
  brasil_bullets: string[];
  agenda: AgendaEvent[];
  sentiment: SentimentData;
  take: string;                // contextual paragraph
  // closing-only
  happened_bullets?: string[];
  agenda_review?: string;
  overnight?: string;
  closing_take?: string;
  model_used: string;
  duration_ms: number;
  status: "processing" | "completed" | "failed";
  error?: string | null;
  created_at: string;
};
```

- [ ] **Step 2: Create sources constants**

```ts
// src/lib/trading/sources.ts
export const MORNING_QUERIES = [
  { label: "Futuros S&P 500", query: "S&P 500 futures pre-market today" },
  { label: "Futuros Nasdaq", query: "Nasdaq futures today" },
  { label: "Ásia fechamento", query: "Asia markets close today" },
  { label: "DXY", query: "DXY dollar index today" },
  { label: "Treasury 10y", query: "US 10 year treasury yield today" },
  { label: "Petróleo WTI", query: "crude oil WTI price today" },
  { label: "Ouro", query: "gold price today" },
  { label: "IBOV futuro", query: "IBOVESPA futuro pré-market hoje" },
  { label: "Dólar PTAX", query: "dólar PTAX câmbio hoje" },
  { label: "Juros DI", query: "juros futuros DI hoje Brasil" },
];

export const CLOSING_QUERIES = [
  { label: "IBOV fechamento", query: "IBOVESPA fechamento hoje resultado" },
  { label: "Dólar fechou", query: "dólar comercial fechamento hoje" },
  { label: "S&P 500 fechou", query: "S&P 500 close today" },
  { label: "Destaque pregão", query: "destaque pregão bolsa hoje" },
  { label: "After market", query: "after market S&P futures tonight" },
];

export const FINANCIAL_RSS = [
  { url: "https://www.infomoney.com.br/feed/", name: "InfoMoney" },
  { url: "https://valor.globo.com/financas/rss.xml", name: "Valor Econômico" },
  { url: "https://www.bloomberglinea.com.br/feed/", name: "Bloomberg Línea" },
  { url: "https://br.investing.com/rss/news.rss", name: "Investing.com BR" },
];

export const HIGH_IMPACT_EVENTS: Record<string, { event: string; impact: "alto" | "medio"; region: "BR" | "EUA" | "Global" }> = {
  copom: { event: "Decisão COPOM (Selic)", impact: "alto", region: "BR" },
  fomc: { event: "Decisão FOMC (Fed Funds Rate)", impact: "alto", region: "EUA" },
  payroll: { event: "Payroll / Non-Farm Payrolls", impact: "alto", region: "EUA" },
  ipca: { event: "IPCA (inflação BR)", impact: "alto", region: "BR" },
  cpi_eua: { event: "CPI (inflação EUA)", impact: "alto", region: "EUA" },
  pib_br: { event: "PIB Brasil", impact: "alto", region: "BR" },
  pib_eua: { event: "GDP EUA", impact: "alto", region: "EUA" },
  pmi: { event: "PMI Industrial / Serviços", impact: "medio", region: "Global" },
  retail: { event: "Retail Sales EUA", impact: "medio", region: "EUA" },
  jobless: { event: "Jobless Claims", impact: "medio", region: "EUA" },
};

export const SENTIMENT_SOURCES = {
  fear_greed_url: "https://production.dataviz.cnn.io/index/fearandgreed/graphdata",
  vix_query: "VIX CBOE volatility index today value",
  put_call_query: "CBOE put call ratio today",
};
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/trading/
git commit -m "feat(trading): types + hardcoded data sources"
```

---

### Task 2: Collector (fetch all data)

**Files:**
- Create: `src/lib/trading/collector.ts`

- [ ] **Step 1: Implement collector**

Collector fetches in parallel:
1. Tavily queries (morning or closing set) → raw bullets
2. Financial RSS → recent headlines
3. Economic calendar (Tavily search on "agenda econômica hoje" + date match against HIGH_IMPACT_EVENTS keywords)
4. Sentiment: CNN Fear & Greed JSON + Tavily for VIX/put-call

```ts
// src/lib/trading/collector.ts
import { searchTavily } from "@/lib/sources/search";
import { fetchAllRssFeeds } from "@/lib/sources/rss";
import type { TradingEdition, AgendaEvent } from "./types";
import { MORNING_QUERIES, CLOSING_QUERIES, FINANCIAL_RSS, HIGH_IMPACT_EVENTS, SENTIMENT_SOURCES } from "./sources";

export type CollectedTradingData = {
  marketBullets: Array<{ label: string; results: Array<{ title: string; content: string; url: string }> }>;
  newsHeadlines: Array<{ title: string; url: string; source_name: string; published_at?: string }>;
  agenda: AgendaEvent[];
  sentiment: { fear_greed: number | null; fear_greed_label: string | null; vix: number | null; put_call: number | null };
};

// Each function: fetchMarketData, fetchFinancialNews, fetchAgenda, fetchSentiment
// All Promise.allSettled, tolerant to failure
// Main: collectTradingData(edition: TradingEdition): Promise<CollectedTradingData>
```

Implementation: parallel fetch with 10s timeouts per source. Each sub-function returns partial data on failure rather than throwing.

- [ ] **Step 2: Commit**

```bash
git add src/lib/trading/collector.ts
git commit -m "feat(trading): collector — parallel fetch of market data, news, agenda, sentiment"
```

---

### Task 3: Claude prompts + generator pipeline

**Files:**
- Create: `src/lib/trading/prompt.ts`
- Create: `src/lib/trading/generator.ts`

- [ ] **Step 1: Create prompts**

Two prompt builders: `buildMorningPrompt(data, date)` and `buildClosingPrompt(data, date)`.

Morning prompt instructs Claude to produce JSON:
```json
{
  "global_bullets": ["5-7 bullets"],
  "brasil_bullets": ["3-5 bullets"],
  "agenda": [{"time":"09:00","event":"...","impact":"alto","region":"BR"}],
  "sentiment_summary": "1 paragraph",
  "take": "1 paragraph contextual, viés implícito, sem recomendação direta"
}
```

Closing adds: `happened_bullets`, `agenda_review`, `overnight`, `closing_take`.

Rules: PT-BR, factual, contextual (viés implícito, sem recomendação). Model: claude-sonnet-4-6, max_tokens: 8000.

- [ ] **Step 2: Create generator pipeline**

```ts
// src/lib/trading/generator.ts
export async function generateTradingBrief(
  userId: string,
  edition: TradingEdition,
  date?: string, // defaults to today BRT
): Promise<{ briefId: string }>
```

Flow:
1. Insert row in `trading_briefs` with status="processing"
2. Call `collectTradingData(edition)`
3. Build prompt → call Claude → extractJson
4. Merge sentiment indicators (collector) + sentiment summary (Claude)
5. Update row with status="completed", content fields
6. On error: update status="failed", error message

- [ ] **Step 3: Commit**

```bash
git add src/lib/trading/prompt.ts src/lib/trading/generator.ts
git commit -m "feat(trading): Claude prompts + generator pipeline (morning + closing)"
```

---

### Task 4: Database table + API routes

**Files:**
- Create: `supabase/migrations/015_trading_briefs.sql`
- Create: `src/app/api/trading/route.ts`
- Create: `src/app/api/trading/[id]/route.ts`
- Create: `src/app/api/cron/trading-broadcast/route.ts`

- [ ] **Step 1: Migration**

```sql
CREATE TABLE trading_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edition TEXT NOT NULL CHECK (edition IN ('morning', 'closing')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  global_bullets JSONB DEFAULT '[]',
  brasil_bullets JSONB DEFAULT '[]',
  agenda JSONB DEFAULT '[]',
  sentiment JSONB DEFAULT '{}',
  take TEXT,
  happened_bullets JSONB,
  agenda_review TEXT,
  overnight TEXT,
  closing_take TEXT,
  model_used TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, edition, date)
);
CREATE INDEX trading_briefs_user_date ON trading_briefs(user_id, date DESC, edition);
ALTER TABLE trading_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trading_briefs_own" ON trading_briefs FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

Apply via Supabase MCP.

- [ ] **Step 2: API routes**

- `GET /api/trading` — list briefs (user, optional ?date=YYYY-MM-DD, limit)
- `POST /api/trading` — generate on-demand `{ edition: "morning"|"closing", date? }`
- `GET /api/trading/[id]` — single brief detail
- `POST /api/cron/trading-broadcast?edition=morning|closing` — cron trigger with CRON_SECRET auth. Fires generateTradingBrief for ALL users who have accessed Trading (or a flag `trading_enabled`). For v1: just current user or all users with a `trading_briefs` row.

- [ ] **Step 3: Update vercel.json with cron schedules**

Add:
```json
{ "path": "/api/cron/trading-broadcast?edition=morning", "schedule": "30 9 * * 1-5" },
{ "path": "/api/cron/trading-broadcast?edition=closing", "schedule": "0 21 * * 1-5" }
```
(09:30 UTC = 06:30 BRT, 21:00 UTC = 18:00 BRT. Weekdays only.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/ src/app/api/trading/ src/app/api/cron/trading-broadcast/ vercel.json
git commit -m "feat(trading): DB table + API routes + cron schedules"
```

---

### Task 5: Frontend — Trading page + components

**Files:**
- Create: `src/app/trading/page.tsx`
- Create: `src/app/trading/loading.tsx`
- Create: `src/components/trading/TradingPanel.tsx`
- Create: `src/components/trading/SentimentCard.tsx`
- Create: `src/components/trading/AgendaTable.tsx`
- Create: `src/components/trading/BulletSection.tsx`
- Create: `src/components/trading/TradingDateNav.tsx`
- Create: `src/components/trading/TradingSkeleton.tsx`

- [ ] **Step 1: Create TradingDateNav**

Date selector (today ± 7 days) + badge toggle "Morning / Closing". Pill-style matching ModeNav design language.

- [ ] **Step 2: Create BulletSection**

Reusable card: colored accent line, title, list of bullets. Props: `title, icon, accent, bullets: string[]`.

- [ ] **Step 3: Create AgendaTable**

Compact table: Horário | Evento | Impacto (with color dot) | Região (BR/EUA flag). Props: `events: AgendaEvent[]`.

- [ ] **Step 4: Create SentimentCard**

Three circular gauges (Fear & Greed 0-100, VIX, Put/Call) side by side. Below: Claude summary paragraph. Colors: green/yellow/red thresholds.

- [ ] **Step 5: Create TradingPanel**

Main layout composing all sections:
```
[TradingDateNav]

Morning layout:
┌──────────────┬──────────────┐
│ Global (5-7) │ Brasil (3-5) │  ← BulletSection × 2
├──────────────┴──────────────┤
│ Agenda do dia               │  ← AgendaTable
├─────────────────────────────┤
│ Sentimento                  │  ← SentimentCard
├─────────────────────────────┤
│ 💡 Contexto do dia          │  ← highlighted take paragraph
└─────────────────────────────┘

Closing layout:
┌─────────────────────────────┐
│ O que aconteceu (5-7)       │  ← BulletSection
├──────────────┬──────────────┤
│ Agenda review│ After/Asia   │
├──────────────┴──────────────┤
│ 💡 Fechamento               │  ← closing take
└─────────────────────────────┘
```
Mobile: stack single column.

- [ ] **Step 6: Create TradingSkeleton**

Matches TradingPanel layout with pulsing blocks.

- [ ] **Step 7: Create /trading page**

```tsx
// src/app/trading/page.tsx
"use client";
// Fetches briefs from /api/trading?date=X
// Shows TradingPanel when data exists
// Shows empty state + "Gerar agora" button when no brief for today
// Auto-triggers generation on first visit if no brief exists for today
```

- [ ] **Step 8: Commit**

```bash
git add src/app/trading/ src/components/trading/
git commit -m "feat(trading): frontend — panel layout with all section components"
```

---

### Task 6: ModeNav + onboarding + final wiring

**Files:**
- Modify: `src/components/ui/ModeNav.tsx`
- Modify: `src/components/onboarding/steps.ts`

- [ ] **Step 1: Add Trading to ModeNav**

Add after Query:
```ts
{ key: "trading", label: "Trading", href: "/trading", icon: CandlestickChart }
```

- [ ] **Step 2: Add Trading onboarding step**

Add between "markets" and "query" in ONBOARDING_STEPS:
```ts
{
  key: "trading",
  title: "Trading — broadcast pré-mercado",
  subtitle: "Briefing diário para day traders de mini contratos.",
  // sections: cenário macro, agenda, sentimento, contexto do dia, closing brief
}
```

Update `keyForPath` to handle `/trading`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ModeNav.tsx src/components/onboarding/steps.ts
git commit -m "feat(trading): add Trading tab to nav + onboarding step"
```

---

### Task 7: Test + deploy

- [ ] **Step 1: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Lint**

```bash
npx eslint src/lib/trading src/app/trading src/app/api/trading src/app/api/cron/trading-broadcast src/components/trading
```

- [ ] **Step 3: Manual test — generate a morning brief**

Via the UI: navigate to /trading, click "Gerar agora", verify all sections render with real data.

- [ ] **Step 4: Push + deploy**

```bash
git push origin master
vercel --prod --yes
```

- [ ] **Step 5: Final commit if any fixes needed**

---

## Dependency graph

```
Task 1 (types+sources) → Task 2 (collector) → Task 3 (prompts+generator)
                                                         ↓
Task 4 (DB+API+cron) depends on Task 3
Task 5 (frontend) depends on Task 4
Task 6 (nav+onboarding) depends on Task 5
Task 7 (test+deploy) depends on all
```

Tasks 1-3 are sequential (each depends on prior). Task 4 depends on 3. Task 5 depends on 4. Tasks 6-7 are final.
