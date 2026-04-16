# Jay Brain — Phase 2: Social Sources

**Date:** 2026-04-16
**Status:** Approved, in implementation
**Builds on:** `2026-04-16-jay-brain-design.md` (Phase 1 — Foundation)

---

## Goal

Add a new content stream to JNews: **social/human voices**, separated cleanly into:

- **Vozes** — curated experts (Twitter handles, YouTube channels) the user trusts
- **Pulso** — crowd sentiment from public communities (Reddit subreddits, optionally StockTwits)

This is a new top-level area `/social` with two tabs. The existing News/Trends/Markets/Trading pipeline is **not modified** — social content has different cadence, shape, and rendering needs.

## Why a separate area

- Cadence is different (real-time-ish vs daily digest)
- Content is short (tweet/post) vs long-form articles
- Trust model is different (named voice vs aggregated source)
- Mixing them into the existing digest would compromise both

## Data Model — Migration `017_social_sources.sql`

**`social_voices`** — curated handles per user
- `id` UUID PK
- `user_id` UUID FK → `auth.users(id)` ON DELETE CASCADE
- `platform` TEXT — `twitter` | `youtube` | `reddit_user`
- `handle` TEXT — e.g. `@stuhlberger`, channel ID, reddit username
- `label` TEXT — display name
- `category` TEXT — `analyst` | `economist` | `trader` | `institution` | `other`
- `is_active` BOOLEAN DEFAULT true
- `created_at` TIMESTAMPTZ

**`crowd_sources`** — public communities to sample
- `id` UUID PK
- `user_id` UUID FK
- `platform` TEXT — `reddit` (Phase 2), `stocktwits` (deferred)
- `identifier` TEXT — e.g. `investimentos`, `wallstreetbets`
- `label` TEXT
- `is_active` BOOLEAN DEFAULT true
- `created_at` TIMESTAMPTZ

**`social_posts`** — cached posts/tweets/videos for rendering
- `id` UUID PK
- `user_id` UUID FK
- `voice_id` UUID FK nullable → `social_voices(id)` ON DELETE CASCADE
- `crowd_source_id` UUID FK nullable → `crowd_sources(id)` ON DELETE CASCADE
- `platform` TEXT
- `external_id` TEXT — platform's id (used for dedup)
- `author` TEXT — username/channel name
- `title` TEXT nullable — for YouTube/Reddit
- `content` TEXT — body or snippet
- `source_url` TEXT
- `image_url` TEXT nullable
- `published_at` TIMESTAMPTZ nullable
- `metadata` JSONB — engagement (likes, comments, views), platform-specific fields
- `fetched_at` TIMESTAMPTZ DEFAULT now()
- UNIQUE (`user_id`, `platform`, `external_id`)

Indexes: `(user_id, fetched_at DESC)`, `(voice_id, published_at DESC)`, `(crowd_source_id, published_at DESC)`.

RLS: standard `user_id = auth.uid()` policies on all three tables.

## Ingestion

`src/lib/social/`:

- **`reddit.ts`** — `fetchSubreddit(identifier)` → fetches `https://www.reddit.com/r/<id>/hot.json?limit=15` (no auth needed). Filters out stickied posts. Returns `SocialPostInput[]`.
- **`youtube.ts`** — `fetchYouTubeChannel(handle)` → uses YouTube channel RSS feed `https://www.youtube.com/feeds/videos.xml?channel_id=X`. If handle starts with `UC`, treat as channel ID; otherwise resolve via `https://www.youtube.com/@handle` lookup (best-effort fallback to RSS via search). Reuses `rss-parser`.
- **`twitter.ts`** — `fetchTwitterHandle(handle)` → uses Tavily with `query: "from:<handle>"` + `include_domains: ["twitter.com", "x.com"]` + `topic: "general"` + `days: 3` to surface recent activity. Best-effort given API constraints.
- **`collector.ts`** — `collectForUser(userId, supabase)` orchestrates all active voices + crowd sources for a user, dedupes via `external_id`, upserts into `social_posts`.
- **`types.ts`** — `SocialPlatform`, `SocialPostInput`, normalized shape.

## API Routes

- `GET/POST/PUT/DELETE /api/social/voices` — CRUD
- `GET/POST/PUT/DELETE /api/social/crowd` — CRUD
- `GET /api/social/feed?type=voices|crowd&limit=50` — returns recent posts
- `POST /api/social/collect` — manually triggers `collectForUser` (no cron in Phase 2)

All routes use the existing `createClient()` server pattern + RLS.

## UI

**`/social` page** with two tabs (`Vozes` | `Pulso`):

- **VozesSection** — feed of recent posts from curated voices, grouped by author or chronological. Each card shows: avatar/platform icon, author, snippet, time, engagement, link.
- **PulsoSection** — feed from configured crowd sources (subreddits). Each card shows: subreddit, post title, snippet, score, comments, time, link.
- **Settings drawer** (button in header) — manage voices and crowd sources via two lists with add/edit/remove modals.
- **Refresh button** — calls `/api/social/collect` then refetches feed.
- Add `/social` to `ModeNav` between Trading and Consulta.

Each card has a **"Ask Jay"** button → opens AskJayPanel with `scope.type = "freeform"` and a preloaded message asking the LLM to analyze the post.

## What's NOT in Phase 2

- Sentiment scoring per post (Phase 3)
- AI summarization of social posts (could be added later if useful)
- Cron-based collection (Phase 3, with alerts)
- StockTwits (deferred)
- Push notifications on voice activity (Phase 3)
- Twitter via paid API (sticking with Tavily best-effort)

## Risks and Caveats

- **Twitter via Tavily** is best-effort — it depends on what Tavily indexed. May miss recent tweets. If quality is bad, consider scrapingbee/twitterapi.io ($30-100/mo) or ditch Twitter from voices.
- **YouTube channel handle resolution** — RSS endpoint requires channel ID (UC...). For `@handle` URLs we fetch the channel page and parse the canonical link. If parsing fails, the user has to paste the channel ID manually.
- **Reddit rate limits** — public JSON endpoint rate-limits per IP. We fetch sequentially with a User-Agent header. Acceptable for Phase 2 (low volume).

## Success Criteria

- Migration applied
- User can add a Twitter handle, YouTube channel, and subreddit
- "Refresh" pulls posts from each, dedupes, persists
- `/social` page renders Vozes and Pulso tabs with the posts
- Each card has Ask Jay quick action
- Build + lint clean, deployed to prod
