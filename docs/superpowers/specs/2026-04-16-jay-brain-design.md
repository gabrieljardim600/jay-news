# Jay Brain — Design Spec

**Date:** 2026-04-16
**Author:** Gabriel + Claude
**Status:** Approved, in implementation

---

## Goal

Add a transversal intelligence layer ("Jay Brain") to JNews that connects all tabs through shared user context, enabling:

1. **Conversational interaction with the digest** — chat ("Ask Jay") + quick actions on cards (Aprofundar, Impacto, Histórico)
2. **Actionable Trading/Markets** — price/event alerts, sentiment scoring, watchlist, temporal comparison
3. **Curated social/human voices** — Twitter/X, Reddit, YouTube/podcasts as new source types, split into "Vozes" (curated experts) and "Pulso" (crowd sentiment)

The layer is **shared infrastructure** for all features — chat knows the watchlist, alerts feed the history, scoring blends official + social sources.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   JAY BRAIN                      │
│                                                  │
│  Watchlist  +  User Context  +  Digest Memory   │
│       └──────────┬──────────┘                    │
│              Context Builder                     │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
      Chat     Alerts     Quick Actions
```

All Jay Brain modules live under `src/lib/jay-brain/`. They share a `ContextBuilder` that, given a user + scope (article/digest/topic/watchlist item), composes a Claude prompt enriched with watchlist, recent interactions, and historical context.

## Data Model

### New tables (migration `016_jay_brain.sql`)

**`watchlist_items`** — globally per user (not scoped to digest_config)
- `id` UUID PK
- `user_id` UUID FK → `auth.users(id)` ON DELETE CASCADE
- `kind` TEXT — `asset` | `theme` | `person` | `company`
- `label` TEXT — display name (e.g. "PETR4", "Selic", "Luis Stuhlberger")
- `keywords` TEXT[] — synonyms / related terms used to match articles
- `metadata` JSONB — kind-specific (e.g. ticker symbol, country, role)
- `is_active` BOOLEAN DEFAULT true
- `created_at` TIMESTAMPTZ

**`user_interactions`** — log of behavioral signals
- `id` UUID PK
- `user_id` UUID FK
- `action` TEXT — `read` | `expand` | `quick_action` | `chat_query` | `pulled_more` | `dismissed`
- `target_type` TEXT — `article` | `digest` | `watchlist_item` | `topic`
- `target_id` UUID nullable
- `payload` JSONB — action-specific data (e.g. quick action variant, chat query)
- `created_at` TIMESTAMPTZ

**`chat_sessions`** — conversational sessions with Jay
- `id` UUID PK
- `user_id` UUID FK
- `title` TEXT — auto-generated from first user message
- `context_type` TEXT — `digest` | `article` | `watchlist` | `freeform`
- `context_id` UUID nullable
- `created_at`, `updated_at` TIMESTAMPTZ

**`chat_messages`** — turns within a session
- `id` UUID PK
- `session_id` UUID FK → `chat_sessions(id)` ON DELETE CASCADE
- `role` TEXT — `user` | `assistant`
- `content` TEXT
- `metadata` JSONB — citations, model, tokens, latency
- `created_at` TIMESTAMPTZ

### Tables for later phases (NOT in Phase 1)

- `alerts_v2` — price/event alerts with thresholds (Phase 3 — current `alerts` table is for keyword news alerts and stays)
- `alert_history` — fired alerts log (Phase 3)
- `social_voices` — curated handles (Phase 2)
- `sentiment_snapshots` — periodic sentiment by asset/theme (Phase 3)

All tables get RLS policies mirroring the project pattern: `user_id = auth.uid()` (and via session/digest ownership for nested ones).

## Context Builder

`src/lib/jay-brain/context-builder.ts` — single function `buildContext({ userId, scope })` that fetches and composes:

1. **User profile snippet** — language, summary style preference, timezone (from `user_settings`)
2. **Watchlist** — active items grouped by kind
3. **Recent interactions** — last 20 interactions (signals what user cares about)
4. **Scope context** — depending on scope:
   - `article` → article title, summary, full_content, source, published_at
   - `digest` → digest summary + top 10 articles
   - `watchlist_item` → recent articles matching the item's keywords (semantic + literal)
   - `topic` → topic definition + recent topical articles
5. **Historical hits** — for `article` scope, search prior digests for related articles using keywords from the article (best-effort, capped)

Output: a structured object the chat module formats into Claude system + user messages.

## Modules

### `src/lib/jay-brain/chat.ts`
- `streamChat(messages, context)` — wraps Anthropic streaming, returns `ReadableStream`
- System prompt: defines Jay's persona (analyst, concise, in pt-BR by default, cites sources)
- Injects `context` block before user message

### `src/lib/jay-brain/quick-actions.ts`
- `buildQuickActionPrompt(action, article)` — templates for the 3 actions:
  - **Aprofundar** — "Me explica essa notícia em mais profundidade — contexto, atores, e desdobramentos prováveis."
  - **Impacto** — "Como isso impacta meus interesses [watchlist]? Seja específico sobre conexões e magnitude."
  - **Histórico** — "Cruza essa notícia com o histórico recente — episódios similares, padrões, comparações."

### API routes

- `GET/POST/PUT/DELETE /api/watchlist` — CRUD (mirrors `topics` route pattern)
- `POST /api/jay-brain/chat` — body: `{ sessionId?, message, scope: { type, id } }`. Streams Claude response. Persists session + messages.
- `GET /api/jay-brain/sessions` — list user's sessions
- `GET /api/jay-brain/sessions/[id]` — fetch session + messages
- `POST /api/jay-brain/interactions` — log interaction (fire-and-forget, no await on UI side)

### UI

- **`AskJayPanel`** (`src/components/jay-brain/AskJayPanel.tsx`) — slide-in drawer from right (75% width on mobile, 480px on desktop). Renders messages, input, streaming text. Open via context: `useAskJay()`.
- **`AskJayProvider`** (`src/context/AskJayContext.tsx`) — manages open/close + current scope.
- **`QuickActions`** (`src/components/jay-brain/QuickActions.tsx`) — three buttons (Aprofundar / Impacto / Histórico) attached to `ArticleRow` (only when expanded) and to highlight cards. Each opens `AskJayPanel` with a pre-loaded message.
- **`/watchlist` page** — list + add/edit/remove items. Linked from header (next to settings) or via Settings/Manage page.

## File Layout

```
src/
  lib/
    jay-brain/
      context-builder.ts
      chat.ts
      quick-actions.ts
      prompts.ts
  app/
    api/
      watchlist/route.ts
      jay-brain/
        chat/route.ts
        sessions/route.ts
        sessions/[id]/route.ts
        interactions/route.ts
    watchlist/
      page.tsx
  components/
    jay-brain/
      AskJayPanel.tsx
      QuickActions.tsx
      ChatMessage.tsx
      WatchlistList.tsx
      WatchlistItemModal.tsx
  context/
    AskJayContext.tsx
  types/index.ts (extend)
supabase/migrations/
  016_jay_brain.sql
```

## Phasing

### Phase 1 — Foundation (this commit)
- Migration `016_jay_brain.sql` (watchlist + interactions + chat_sessions + chat_messages + RLS)
- Watchlist CRUD API + page
- Context Builder
- Ask Jay chat (streaming) + panel + provider
- Quick actions on `ArticleRow` (expanded state) and `HighlightCards`
- Header entry for `/watchlist`

### Phase 2 — Social sources
- Twitter/X via Tavily-targeted search of `site:twitter.com` for curated handles, or paid API if Gabriel approves cost
- Reddit via official JSON API
- YouTube transcripts via `youtube-transcript-api` equivalent (Node port) or whisper.cpp on demand
- New tables: `social_voices`
- New source types in `rss_sources` or a dedicated `social_sources` table
- "Vozes" / "Pulso" UI sections in Markets and Trading tabs

### Phase 3 — Alerts & sentiment
- Alerts v2: price/event alerts (BCB, Yahoo Finance) via 15-min cron
- Sentiment scoring per article + watchlist item
- PWA push notifications (VAPID keys + service worker + `web-push`)
- Historical comparison module (uses Context Builder + semantic dedup infra)

## Trade-offs and Risks

**Twitter/X (Phase 2):** Official API is paid (~$100/mo basic tier). Scraping is brittle and against ToS. Best-effort path: use Tavily with `site:twitter.com/<handle>` queries for the curated voices list (low volume, OK for daily monitoring). Crowd "Pulso" comes from Reddit + StockTwits as Twitter substitutes.

**Streaming costs:** Each chat turn re-builds context (~2k tokens). Use prompt caching (Anthropic's `cache_control`) on the system prompt + watchlist block to cut cost ~80% on multi-turn conversations.

**RLS on chat_messages:** Access via session ownership. Standard Supabase pattern.

**No new env vars** for Phase 1 — uses existing `ANTHROPIC_API_KEY`.

## Success Criteria

Phase 1 is done when:
- Migration applied without errors
- User can add/edit/remove watchlist items
- "Ask Jay" panel opens from header, accepts free-form questions, streams Claude response
- Each article (in expanded state) shows 3 quick action buttons that open Ask Jay with pre-loaded contextualized message
- All interactions are logged to `user_interactions`
- Build passes (`npm run build`), typecheck clean
- Deployed to Vercel production
