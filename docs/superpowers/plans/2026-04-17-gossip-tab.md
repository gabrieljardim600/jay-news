# Gossip Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a aba Gossip — infraestrutura user-driven para acompanhar fofoca BR+internacional via feeds (RSS/Twitter/YouTube/Reddit) e tópicos editoriais tagueáveis (pessoas/casais/eventos/shows), com dossiê diário gerado por Claude Haiku.

**Architecture:** Namespace próprio `gossip_*` (tabelas + `src/lib/gossip/`). Fetchers de Twitter/YouTube/Reddit importam e encapsulam os de `src/lib/social/` (zero duplicação). RSS portal fetcher é novo (baseado em `rss-parser`, mesma lib do `src/lib/news/`). Matching em 2 camadas (alias regex + Claude classifier). Dossiê daily + manual refresh. Padrão de file structure e API routes idêntico à aba Social existente.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), `@anthropic-ai/sdk` (Haiku 4.5), `rss-parser`, Tavily (via wrapper social). Sem test framework novo — projeto não usa; verificação via typecheck, curl e browser (convenção do repo).

**Spec de referência:** `docs/superpowers/specs/2026-04-17-gossip-tab-design.md`

---

## File Structure

### Novos
```
supabase/migrations/019_gossip.sql
src/lib/gossip/
  ├─ types.ts                 # TS types domínio
  ├─ service.ts               # CRUD wrappers sobre Supabase
  ├─ templates.ts             # fontes curadas (BR + INT)
  ├─ collector.ts             # orquestra fetch + persist
  ├─ matcher.ts               # topic matching (2 camadas)
  ├─ dossier.ts               # geração dossiê via Claude
  ├─ aliases.ts               # suggest-aliases via Claude
  ├─ spike.ts                 # cálculo spike_score
  └─ fetchers/
      ├─ rss.ts               # novo — portais
      ├─ twitter.ts           # wrapper de src/lib/social/twitter.ts
      ├─ youtube.ts           # wrapper de src/lib/social/youtube.ts
      └─ reddit.ts            # wrapper de src/lib/social/reddit.ts

src/app/api/gossip/
  ├─ sources/
  │   ├─ route.ts             # GET, POST
  │   └─ [id]/route.ts        # PATCH, DELETE
  ├─ topics/
  │   ├─ route.ts             # GET, POST
  │   ├─ [id]/route.ts        # PATCH, DELETE
  │   ├─ [id]/refresh/route.ts        # POST manual refresh
  │   ├─ [id]/dossiers/route.ts       # GET histórico
  │   └─ suggest-aliases/route.ts     # POST aliases IA
  ├─ feed/route.ts            # GET feed filtrado
  ├─ collect/route.ts         # POST refresh geral
  ├─ posts/[id]/tag-topic/route.ts    # POST feedback
  └─ dossiers/route.ts        # GET dossiês do dia

src/app/api/cron/
  ├─ gossip-daily/route.ts
  └─ gossip-retention/route.ts

src/app/gossip/
  ├─ page.tsx                 # principal
  ├─ new/page.tsx             # onboarding wizard
  └─ [topicId]/page.tsx       # timeline histórica

src/components/gossip/
  ├─ DossierGrid.tsx
  ├─ DossierCard.tsx
  ├─ FeedList.tsx
  ├─ PostCard.tsx
  ├─ FeedFilters.tsx
  ├─ SettingsDrawer.tsx
  ├─ SourceFormModal.tsx
  ├─ TopicFormModal.tsx
  └─ OnboardingWizard.tsx
```

### Modificados
```
src/components/ui/ModeNav.tsx       # adiciona aba Gossip
vercel.json                          # adiciona 2 crons
src/types/index.ts                  # exports de gossip types (se aplicável)
```

---

## Convenções

- **Supabase client:** server-side usa `createClient` de `@/lib/supabase/server`; client-side usa `@/lib/supabase/client`. RLS é a única proteção — nunca usar `service_role` no Next.js API (só no worker Railway).
- **Auth:** toda route protegida faz `const { data: { user } } = await supabase.auth.getUser()` e 401 se `!user`.
- **Commits:** um commit por task (feat/fix/docs/refactor). Mensagem curta em PT-BR, seguir padrão `feat(gossip): ...`.
- **Não rodar `npm run build`** entre tasks — só no final. Typecheck basta: `npx tsc --noEmit`.
- **Refs de arquivos existentes:** inspirar-se em `src/lib/social/`, `src/lib/markets/`, `src/app/api/social/`, `src/app/social/page.tsx`, `src/components/ui/SourcesManager` (se houver). **Ler antes de escrever.**

---

## Phase 1 — Fundação (backend base)

### Task 1: Migration 019 — schema + RLS + triggers

**Files:**
- Create: `supabase/migrations/019_gossip.sql`

- [ ] **Step 1: Criar arquivo de migration**

Copiar SQL completo da §Data model do spec (`docs/superpowers/specs/2026-04-17-gossip-tab-design.md`, seção "Data model — Migration 019"). Usa `CREATE TABLE IF NOT EXISTS` e `DROP POLICY IF EXISTS ...; CREATE POLICY ...` para ser idempotente (padrão adotado na migration 018).

- [ ] **Step 2: Aplicar via MCP Supabase**

```
Tool: mcp__claude_ai_Supabase__apply_migration
project_id: upespttemhmrewszxjet
name: gossip
query: <conteúdo da migration com IF NOT EXISTS nas tabelas e DROP POLICY IF EXISTS antes dos CREATE POLICY>
```

Expected: `{"success": true}`.

- [ ] **Step 3: Verificar criação**

```
Tool: mcp__claude_ai_Supabase__list_tables
project_id: upespttemhmrewszxjet
schemas: ["public"]
```

Expected: listagem inclui `gossip_sources`, `gossip_posts`, `gossip_topics`, `gossip_post_topics`, `gossip_dossiers`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/019_gossip.sql
git commit -m "feat(gossip): migration 019 — sources, posts, topics, dossiers + RLS"
```

---

### Task 2: TypeScript types

**Files:**
- Create: `src/lib/gossip/types.ts`

- [ ] **Step 1: Criar types.ts**

```ts
// src/lib/gossip/types.ts

export type GossipPlatform = "rss" | "twitter" | "youtube" | "reddit";
export type GossipSourceTier = "primary" | "proxy" | "aggregator";
export type GossipTopicType = "person" | "couple" | "event" | "show" | "brand";
export type MatchedBy = "alias" | "claude" | "manual" | "manual_negative";
export type SpikeLevel = "low" | "medium" | "high";

export interface GossipSource {
  id: string;
  user_id: string;
  platform: GossipPlatform;
  handle: string;
  label: string;
  tier: GossipSourceTier;
  active: boolean;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GossipPost {
  id: string;
  user_id: string;
  source_id: string;
  platform: GossipPlatform;
  external_id: string;
  url: string;
  author: string | null;
  title: string | null;
  body: string | null;
  image_url: string | null;
  published_at: string;
  raw: unknown;
  created_at: string;
}

export interface GossipTopic {
  id: string;
  user_id: string;
  type: GossipTopicType;
  name: string;
  aliases: string[];
  image_url: string | null;
  priority: number;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GossipPostTopic {
  post_id: string;
  topic_id: string;
  confidence: number;
  matched_by: MatchedBy;
  created_at: string;
}

export interface GossipDossier {
  id: string;
  user_id: string;
  topic_id: string;
  date: string;
  summary: string;
  key_quotes: Array<{ text: string; source_label: string; url: string }>;
  spike_score: number;
  spike_level: SpikeLevel;
  post_ids: string[];
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_cents: number | null;
  created_at: string;
}

// Input shape para fetchers — o que cada fetcher retorna antes de persistir
export interface GossipPostInput {
  source_id: string;
  platform: GossipPlatform;
  external_id: string;
  url: string;
  author: string | null;
  title: string | null;
  body: string | null;
  image_url: string | null;
  published_at: string;
  raw: unknown;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/gossip/types.ts
git commit -m "feat(gossip): types de domínio"
```

---

### Task 3: RSS fetcher (portais)

**Files:**
- Create: `src/lib/gossip/fetchers/rss.ts`

**Referências a ler antes:**
- `src/lib/news/` (se existir) ou `src/lib/markets/collector.ts` — como o projeto usa `rss-parser`.

- [ ] **Step 1: Criar rss.ts**

```ts
// src/lib/gossip/fetchers/rss.ts
import Parser from "rss-parser";
import type { GossipPostInput, GossipSource } from "../types";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "jay-news-gossip/1.0 (+https://jaynews.app)" },
});

export async function fetchGossipRss(source: GossipSource): Promise<GossipPostInput[]> {
  try {
    const feed = await parser.parseURL(source.handle);
    return (feed.items ?? [])
      .filter((item) => item.link && (item.guid || item.link))
      .map((item) => ({
        source_id: source.id,
        platform: "rss" as const,
        external_id: String(item.guid ?? item.link!),
        url: item.link!,
        author: item.creator ?? item.author ?? null,
        title: item.title ?? null,
        body: stripHtml(item.contentSnippet ?? item.content ?? ""),
        image_url: extractImage(item),
        published_at: item.isoDate ?? new Date().toISOString(),
        raw: item,
      }));
  } catch (err) {
    console.error(`[gossip:rss] erro em ${source.handle}:`, err);
    return [];
  }
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim().slice(0, 4000);
}

function extractImage(item: Record<string, unknown>): string | null {
  // tenta enclosure, media:thumbnail, og:image no content
  const enclosure = (item as { enclosure?: { url?: string; type?: string } }).enclosure;
  if (enclosure?.url && enclosure.type?.startsWith("image/")) return enclosure.url;
  const media = (item as { ["media:thumbnail"]?: { $?: { url?: string } } })["media:thumbnail"];
  if (media?.$?.url) return media.$.url;
  const content = String((item as { content?: string }).content ?? "");
  const m = content.match(/<img[^>]+src="([^"]+)"/i);
  return m ? m[1] : null;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/gossip/fetchers/rss.ts
git commit -m "feat(gossip): rss fetcher para portais"
```

---

### Task 4: Fetcher wrappers (Twitter, YouTube, Reddit)

**Files:**
- Create: `src/lib/gossip/fetchers/twitter.ts`
- Create: `src/lib/gossip/fetchers/youtube.ts`
- Create: `src/lib/gossip/fetchers/reddit.ts`

**Referências a ler antes:**
- `src/lib/social/twitter.ts`, `src/lib/social/youtube.ts`, `src/lib/social/reddit.ts` — entender assinatura e retorno.

- [ ] **Step 1: Criar twitter.ts wrapper**

```ts
// src/lib/gossip/fetchers/twitter.ts
import { fetchTwitterHandle } from "@/lib/social/twitter";
import type { GossipPostInput, GossipSource } from "../types";

export async function fetchGossipTwitter(source: GossipSource): Promise<GossipPostInput[]> {
  const posts = await fetchTwitterHandle(source.handle);
  return posts.map((p) => ({
    source_id: source.id,
    platform: "twitter" as const,
    external_id: p.external_id,
    url: p.url,
    author: p.author ?? source.label,
    title: null,
    body: p.body,
    image_url: p.image_url ?? null,
    published_at: p.published_at,
    raw: p.raw,
  }));
}
```

Se a assinatura do `fetchTwitterHandle` for diferente (ver arquivo real), ajustar o mapeamento. Comentário inline explicando o mapeamento campo-a-campo só se houver divergência surpreendente.

- [ ] **Step 2: Criar youtube.ts wrapper**

Mesmo padrão, importando `fetchYouTubeChannel` de `src/lib/social/youtube.ts`.

- [ ] **Step 3: Criar reddit.ts wrapper**

Importa `fetchSubreddit` e `fetchRedditUser` de `src/lib/social/reddit.ts`. Detecta no `source.handle` se começa com `u/` ou `r/` e chama função correspondente.

```ts
export async function fetchGossipReddit(source: GossipSource): Promise<GossipPostInput[]> {
  const posts = source.handle.startsWith("u/")
    ? await fetchRedditUser(source.handle.slice(2))
    : await fetchSubreddit(source.handle.replace(/^r\//, ""));
  return posts.map((p) => ({ /* mesmo mapeamento */ }));
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/gossip/fetchers/
git commit -m "feat(gossip): wrappers de fetcher (twitter/youtube/reddit) sobre src/lib/social"
```

---

### Task 5: Collector (orquestração)

**Files:**
- Create: `src/lib/gossip/collector.ts`

- [ ] **Step 1: Criar collector.ts**

```ts
// src/lib/gossip/collector.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GossipSource, GossipPostInput } from "./types";
import { fetchGossipRss } from "./fetchers/rss";
import { fetchGossipTwitter } from "./fetchers/twitter";
import { fetchGossipYoutube } from "./fetchers/youtube";
import { fetchGossipReddit } from "./fetchers/reddit";

export interface CollectReport {
  fetched: number;
  inserted: number;
  errors: string[];
  bySource: Array<{ source_id: string; label: string; count: number; status: "ok" | "error"; error?: string }>;
}

export async function collectGossipForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<CollectReport> {
  const { data: sources, error } = await supabase
    .from("gossip_sources")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true);
  if (error) throw error;

  const bySource: CollectReport["bySource"] = [];
  const errors: string[] = [];
  let fetched = 0;
  let inserted = 0;

  for (const src of (sources ?? []) as GossipSource[]) {
    try {
      const posts = await fetchForSource(src);
      fetched += posts.length;
      const added = await upsertPosts(supabase, userId, posts);
      inserted += added;
      bySource.push({ source_id: src.id, label: src.label, count: added, status: "ok" });
      await supabase.from("gossip_sources").update({ last_fetched_at: new Date().toISOString() }).eq("id", src.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${src.label}: ${msg}`);
      bySource.push({ source_id: src.id, label: src.label, count: 0, status: "error", error: msg });
    }
  }

  return { fetched, inserted, errors, bySource };
}

async function fetchForSource(src: GossipSource): Promise<GossipPostInput[]> {
  switch (src.platform) {
    case "rss": return fetchGossipRss(src);
    case "twitter": return fetchGossipTwitter(src);
    case "youtube": return fetchGossipYoutube(src);
    case "reddit": return fetchGossipReddit(src);
  }
}

async function upsertPosts(
  supabase: SupabaseClient,
  userId: string,
  posts: GossipPostInput[]
): Promise<number> {
  if (posts.length === 0) return 0;
  const rows = posts.map((p) => ({ ...p, user_id: userId }));
  // ON CONFLICT (user_id, platform, external_id) DO NOTHING
  const { data, error } = await supabase
    .from("gossip_posts")
    .upsert(rows, { onConflict: "user_id,platform,external_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/gossip/collector.ts
git commit -m "feat(gossip): collector orquestrando fetchers + upsert"
```

---

### Task 6: Sources API routes

**Files:**
- Create: `src/app/api/gossip/sources/route.ts` (GET, POST)
- Create: `src/app/api/gossip/sources/[id]/route.ts` (PATCH, DELETE)

**Referência a seguir:** `src/app/api/social/voices/route.ts`.

- [ ] **Step 1: Criar GET/POST `/api/gossip/sources`**

GET retorna `{ data: GossipSource[] }` ordenado por `created_at DESC`.
POST valida body `{ platform, handle, label, tier? }`, retorna source criado. 400 em validação falha.

- [ ] **Step 2: Criar PATCH/DELETE `/api/gossip/sources/[id]`**

PATCH aceita parcial `{ active?, label?, tier? }`. DELETE remove (cascade apaga posts).

- [ ] **Step 3: Curl smoke test (dev server)**

```bash
npm run dev   # (deixar rodando)
# em outra shell, após login via browser em http://localhost:3000:
curl -X POST http://localhost:3000/api/gossip/sources -H "Content-Type: application/json" \
  -H "Cookie: <copiar cookie sb-* do browser>" \
  -d '{"platform":"rss","handle":"https://revistaquem.globo.com/rss/ultimas/feed.xml","label":"Quem","tier":"primary"}'
```

Expected: 200, JSON da source criada.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/gossip/sources/
git commit -m "feat(gossip): api sources (CRUD)"
```

---

### Task 7: Topics API routes

**Files:**
- Create: `src/app/api/gossip/topics/route.ts` (GET, POST)
- Create: `src/app/api/gossip/topics/[id]/route.ts` (PATCH, DELETE)

Mesmo padrão de sources. Body do POST: `{ type, name, aliases?: string[], priority? }`.

Aliases são armazenados lowercased. Se body não fornecer, array vazio — Task 17 adiciona sugestão IA depois.

- [ ] **Step 1-3:** criar, typecheck, curl test.
- [ ] **Step 4:** commit `feat(gossip): api topics (CRUD)`.

---

### Task 8: ModeNav — adicionar aba Gossip

**Files:**
- Modify: `src/components/ui/ModeNav.tsx`

- [ ] **Step 1: Adicionar ícone + entry**

```tsx
import { ..., Sparkles } from "lucide-react";

type Mode = { key: "news" | ... | "gossip" | "query"; ... };

const MODES: Mode[] = [
  ...existente,
  { key: "brands", label: "Brands", href: "/brands", icon: Palette },
  { key: "gossip", label: "Gossip", href: "/gossip", icon: Sparkles },
  { key: "query", label: "Consulta", href: "/query", icon: Search },
];
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/components/ui/ModeNav.tsx
git commit -m "feat(gossip): aba no ModeNav"
```

---

## Phase 2 — UI básica

### Task 9: `/gossip` page skeleton

**Files:**
- Create: `src/app/gossip/page.tsx`

Baseado em `src/app/social/page.tsx`. Componentes a criar nas próximas tasks — por ora, stub com:
- `AppHeader` + botão "Atualizar agora" + botão "Settings" (abre drawer).
- Seção "Dossiês de hoje" com placeholder.
- Seção "Feed" com placeholder.
- Detecta se user tem 0 sources → redirect `/gossip/new` (onboarding).

- [ ] **Step 1-2:** criar página mínima, typecheck.
- [ ] **Step 3:** abrir `http://localhost:3000/gossip` no browser, ver skeleton.
- [ ] **Step 4:** commit `feat(gossip): página base /gossip`.

---

### Task 10: Feed endpoint + componentes

**Files:**
- Create: `src/app/api/gossip/feed/route.ts`
- Create: `src/components/gossip/FeedList.tsx`
- Create: `src/components/gossip/PostCard.tsx`
- Create: `src/components/gossip/FeedFilters.tsx`
- Modify: `src/app/gossip/page.tsx`

- [ ] **Step 1: `/api/gossip/feed` GET**

Query params: `topic_id?`, `source_id?`, `since?` (ISO date, default 72h atrás). Retorna até 100 posts ordenados por `published_at DESC` com `source_label` join e `matched_topics` via `gossip_post_topics`.

- [ ] **Step 2: `PostCard`** — thumb (`image_url`), source label + tier badge, author, title/body snippet (200 chars), link externo (target `_blank`), menu kebab com ações "Marcar como relacionado a..." / "Não é sobre..." (implementar na Task 16).

- [ ] **Step 3: `FeedList`** — client component que busca do endpoint a cada mount. Loading/empty states.

- [ ] **Step 4: `FeedFilters`** — chips topic + chips source com toggle (só 1 ativo por vez). Altera query param e re-fetch.

- [ ] **Step 5: integrar em `/gossip/page.tsx`**

- [ ] **Step 6: browser smoke test.**

- [ ] **Step 7: commit** `feat(gossip): feed endpoint + FeedList/PostCard/FeedFilters`.

---

### Task 11: SettingsDrawer + SourceFormModal + TopicFormModal

**Files:**
- Create: `src/components/gossip/SettingsDrawer.tsx`
- Create: `src/components/gossip/SourceFormModal.tsx`
- Create: `src/components/gossip/TopicFormModal.tsx`

Padrão do `src/components/social/SourcesManager.tsx` (se existir) ou qualquer outro modal do projeto.

`SettingsDrawer` abre pelo botão "Settings" do header. Duas abas: "Fontes" e "Topics". Cada aba lista itens atuais com botão "+ Adicionar" que abre o modal correspondente.

`SourceFormModal`: `platform` (select), `handle` (input), `label` (input auto-preenchido por handle quando possível), `tier` (select, default primary). Submit → POST `/api/gossip/sources` → refresh drawer.

`TopicFormModal`: `type` (select), `name` (input), `aliases` (chips editáveis, por ora vazio por default). Submit → POST `/api/gossip/topics` → refresh drawer.

- [ ] **Step 1-4:** criar 3 arquivos, integrar no header do `/gossip/page.tsx`.
- [ ] **Step 5:** smoke test — adicionar 1 source RSS + 1 topic no browser, ver aparecer.
- [ ] **Step 6:** commit `feat(gossip): SettingsDrawer + modais de source/topic`.

---

### Task 12: Endpoint de collect manual + botão Atualizar

**Files:**
- Create: `src/app/api/gossip/collect/route.ts`
- Modify: `src/app/gossip/page.tsx` (wire up botão)

- [ ] **Step 1: `/api/gossip/collect` POST**

Autentica, chama `collectGossipForUser(supabase, user.id)`, retorna `CollectReport`.

- [ ] **Step 2: Botão "Atualizar agora"**

No `/gossip/page.tsx`, onClick → POST `/api/gossip/collect` com loading spinner. Ao completar, re-fetch do feed. Toast com `inserted`/`errors.length`.

- [ ] **Step 3: Browser smoke test**

Adicionar source RSS de `https://revistaquem.globo.com/rss/ultimas/feed.xml` via drawer. Clicar "Atualizar agora". Ver posts aparecendo no feed.

- [ ] **Step 4: Commit** `feat(gossip): collect endpoint + botão atualizar`.

---

## Phase 3 — Matching + Dossiê

### Task 13: Matcher camada 1 (alias regex)

**Files:**
- Create: `src/lib/gossip/matcher.ts`

- [ ] **Step 1: Implementar `matchPostAliases`**

```ts
// src/lib/gossip/matcher.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GossipPost, GossipTopic } from "./types";

export interface MatchResult {
  post_id: string;
  topic_id: string;
  confidence: number;
  matched_by: "alias" | "claude";
}

export function matchByAliases(
  post: Pick<GossipPost, "id" | "title" | "body">,
  topics: GossipTopic[]
): MatchResult[] {
  const haystack = `${post.title ?? ""} ${post.body ?? ""}`.toLowerCase();
  const matches: MatchResult[] = [];
  for (const t of topics) {
    for (const alias of t.aliases) {
      if (alias.length < 3) continue;
      // word-boundary match case-insensitive
      const re = new RegExp(`\\b${escapeRegex(alias.toLowerCase())}\\b`, "i");
      if (re.test(haystack)) {
        matches.push({ post_id: post.id, topic_id: t.id, confidence: 1.0, matched_by: "alias" });
        break; // um match por topic basta
      }
    }
  }
  return matches;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function persistMatches(
  supabase: SupabaseClient,
  matches: MatchResult[]
): Promise<void> {
  if (matches.length === 0) return;
  const { error } = await supabase.from("gossip_post_topics").upsert(
    matches.map((m) => ({
      post_id: m.post_id,
      topic_id: m.topic_id,
      confidence: m.confidence,
      matched_by: m.matched_by,
    })),
    { onConflict: "post_id,topic_id", ignoreDuplicates: false }
  );
  if (error) throw error;
}
```

- [ ] **Step 2: Integrar no collector**

Após upsert dos posts, para cada `inserted post`, rodar `matchByAliases` contra topics ativos do user + `persistMatches`. Atenção: o upsert do `gossip_posts` com `ignoreDuplicates: true` retorna apenas IDs dos inseridos — usar isso para evitar re-matching.

- [ ] **Step 3: Typecheck + smoke test**

Criar topic "Anitta" com aliases `["anitta", "larissa machado"]`. Clicar "Atualizar agora". Verificar no Supabase Table Editor que `gossip_post_topics` tem linhas.

- [ ] **Step 4: Commit** `feat(gossip): matcher camada 1 (alias regex)`.

---

### Task 14: Matcher camada 2 (Claude classifier)

**Files:**
- Modify: `src/lib/gossip/matcher.ts`

- [ ] **Step 1: Adicionar `matchByClaude`**

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function matchByClaude(
  post: Pick<GossipPost, "id" | "title" | "body">,
  topics: GossipTopic[]
): Promise<MatchResult[]> {
  if (topics.length === 0) return [];
  const prompt = `Dado o post abaixo, quais desses topics são mencionados?

POST:
Título: ${post.title ?? ""}
Corpo: ${(post.body ?? "").slice(0, 800)}

TOPICS:
${topics.map((t, i) => `${i + 1}. ${t.name} (${t.type}) — aliases: ${t.aliases.join(", ")}`).join("\n")}

Retorne JSON: { "matches": [{ "topic_index": 1, "confidence": 0.8 }, ...] }
Só inclua se confidence >= 0.6. Array vazio se nada bater.`;

  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content[0]?.type === "text" ? res.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { matches?: Array<{ topic_index: number; confidence: number }> };
    return (parsed.matches ?? [])
      .filter((m) => m.confidence >= 0.6 && topics[m.topic_index - 1])
      .map((m) => ({
        post_id: post.id,
        topic_id: topics[m.topic_index - 1].id,
        confidence: m.confidence,
        matched_by: "claude" as const,
      }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Gating no collector**

Chamar `matchByClaude` apenas para posts:
- cuja source tem `tier in ('proxy','aggregator')`,
- que NÃO tiveram match na camada 1,
- e que contêm `≥1 sequência de nomes próprios` (simples: `/[A-ZÀ-Ý][a-zà-ý]+(\s+[A-ZÀ-Ý][a-zà-ý]+){1,3}/`).

- [ ] **Step 3: Smoke test**

Adicionar source `@PopCrave` (tier proxy). Aguardar coleta. Verificar que posts sem alias match mas com nomes próprios disparam call Claude.

- [ ] **Step 4: Commit** `feat(gossip): matcher camada 2 (claude classifier)`.

---

### Task 15: Spike calculator

**Files:**
- Create: `src/lib/gossip/spike.ts`

- [ ] **Step 1: Implementar `calcSpikeScore`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpikeLevel } from "./types";

export async function calcSpikeForTopic(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
  referenceDate: Date = new Date()
): Promise<{ score: number; level: SpikeLevel; count24h: number; avg7d: number }> {
  const end24 = referenceDate.toISOString();
  const start24 = new Date(referenceDate.getTime() - 24 * 3600_000).toISOString();
  const start7d = new Date(referenceDate.getTime() - 7 * 24 * 3600_000).toISOString();

  const { count: c24 } = await supabase
    .from("gossip_post_topics")
    .select("post_id, gossip_posts!inner(user_id, published_at)", { count: "exact", head: true })
    .eq("topic_id", topicId)
    .eq("gossip_posts.user_id", userId)
    .gte("gossip_posts.published_at", start24)
    .lt("gossip_posts.published_at", end24);

  const { count: c7d } = await supabase
    .from("gossip_post_topics")
    .select("post_id, gossip_posts!inner(user_id, published_at)", { count: "exact", head: true })
    .eq("topic_id", topicId)
    .eq("gossip_posts.user_id", userId)
    .gte("gossip_posts.published_at", start7d);

  const count24h = c24 ?? 0;
  const avg7d = Math.max((c7d ?? 0) / 7, 0.5);
  const score = count24h / avg7d;
  const level: SpikeLevel = score >= 3 ? "high" : score >= 1.5 ? "medium" : "low";
  return { score, level, count24h, avg7d };
}
```

- [ ] **Step 2: Typecheck + commit** `feat(gossip): spike score calculator`.

---

### Task 16: Dossier generator

**Files:**
- Create: `src/lib/gossip/dossier.ts`

- [ ] **Step 1: Implementar `generateDossier`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GossipTopic, GossipDossier, SpikeLevel } from "./types";
import { calcSpikeForTopic } from "./spike";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = "claude-haiku-4-5-20251001";

export async function generateDossierForTopic(
  supabase: SupabaseClient,
  userId: string,
  topic: GossipTopic,
  date: Date = new Date()
): Promise<GossipDossier | null> {
  const start = new Date(date.getTime() - 24 * 3600_000).toISOString();
  const { data: posts } = await supabase
    .from("gossip_posts")
    .select("id, title, body, url, author, published_at, gossip_sources(label, tier), gossip_post_topics!inner(topic_id, matched_by)")
    .eq("user_id", userId)
    .eq("gossip_post_topics.topic_id", topic.id)
    .neq("gossip_post_topics.matched_by", "manual_negative")
    .gte("published_at", start)
    .order("published_at", { ascending: false })
    .limit(40);

  if (!posts || posts.length === 0) return null;

  const spike = await calcSpikeForTopic(supabase, userId, topic.id, date);

  const prompt = `Topic: ${topic.name} (${topic.type})
Posts das últimas 24h (${posts.length}):
${posts.map((p, i) => `${i + 1}. [${p.gossip_sources.label}] ${p.author ?? ""} — "${p.title ?? ""}"\n   ${(p.body ?? "").slice(0, 350)}\n   ${p.url}`).join("\n\n")}

Retorne JSON estrito:
{
  "summary": "3-5 linhas em português informal, tom pop-news, SEM inventar fato",
  "key_quotes": [{"text": "...", "source_label": "...", "url": "..."}],
  "post_ids_used": ["uuid", ...]
}
Se não houver fato novo, summary = "Dia calmo — sem novidade quente sobre ${topic.name}."`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: "Você é redator de fofoca brasileira. Não inventa fato; só usa o que está nos posts.",
    messages: [{ role: "user", content: prompt }],
  });

  const text = res.content[0]?.type === "text" ? res.content[0].text : "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;

  let parsed: { summary: string; key_quotes: GossipDossier["key_quotes"]; post_ids_used: string[] };
  try { parsed = JSON.parse(m[0]); } catch { return null; }

  const costCents =
    ((res.usage.input_tokens / 1_000_000) * 100 +
     (res.usage.output_tokens / 1_000_000) * 500);

  const row = {
    user_id: userId,
    topic_id: topic.id,
    date: date.toISOString().slice(0, 10),
    summary: parsed.summary,
    key_quotes: parsed.key_quotes ?? [],
    spike_score: spike.score,
    spike_level: spike.level,
    post_ids: parsed.post_ids_used ?? posts.map((p) => p.id),
    model: MODEL,
    input_tokens: res.usage.input_tokens,
    output_tokens: res.usage.output_tokens,
    cost_cents: costCents,
  };

  const { data, error } = await supabase
    .from("gossip_dossiers")
    .upsert(row, { onConflict: "user_id,topic_id,date" })
    .select("*")
    .single();
  if (error) throw error;
  return data as GossipDossier;
}

export async function generateDossiersForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<GossipDossier[]> {
  const { data: topics } = await supabase
    .from("gossip_topics")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true);

  const results: GossipDossier[] = [];
  for (const topic of (topics ?? []) as GossipTopic[]) {
    const d = await generateDossierForTopic(supabase, userId, topic);
    if (d) results.push(d);
  }
  return results;
}
```

- [ ] **Step 2: Typecheck + commit** `feat(gossip): dossier generator (Haiku)`.

---

### Task 17: Dossier API routes + DossierGrid/DossierCard

**Files:**
- Create: `src/app/api/gossip/dossiers/route.ts` (GET do dia)
- Create: `src/app/api/gossip/topics/[id]/dossiers/route.ts` (GET histórico)
- Create: `src/app/api/gossip/topics/[id]/refresh/route.ts` (POST manual)
- Create: `src/components/gossip/DossierGrid.tsx`
- Create: `src/components/gossip/DossierCard.tsx`
- Modify: `src/app/gossip/page.tsx`

- [ ] **Step 1:** `GET /api/gossip/dossiers?date=` — retorna dossiers do user pra data (default hoje), com join em `gossip_topics` pra `name`/`type`/`image_url`.

- [ ] **Step 2:** `POST /api/gossip/topics/[id]/refresh` — chama `generateDossierForTopic` inline (não dispara matcher; assume que já rodou no last collect). Retorna dossier atualizado.

- [ ] **Step 3:** `GET /api/gossip/topics/[id]/dossiers?limit=30` — histórico.

- [ ] **Step 4:** `DossierCard` — foto topic + nome + spike badge (🔥 high / 📈 medium / nada low) + summary 3 linhas + button "Atualizar". onClick botão → POST refresh → re-render com dossier novo. Card clicável → navega pra `/gossip/[topicId]`.

- [ ] **Step 5:** `DossierGrid` — carrega `/api/gossip/dossiers`, renderiza grid 2 cols mobile / 3 desktop.

- [ ] **Step 6:** Integra `DossierGrid` no topo de `/gossip/page.tsx`.

- [ ] **Step 7:** Browser smoke test — "Atualizar agora" deve produzir dossiers (após matcher ter preenchido `gossip_post_topics`).

- [ ] **Step 8:** Commit `feat(gossip): dossier endpoints + DossierGrid/Card`.

---

### Task 18: Tag-topic endpoint (feedback loop)

**Files:**
- Create: `src/app/api/gossip/posts/[id]/tag-topic/route.ts`
- Modify: `src/components/gossip/PostCard.tsx`

- [ ] **Step 1:** POST `/api/gossip/posts/[id]/tag-topic` body `{ topic_id, action }`.

```ts
// confirm → upsert matched_by='manual', confidence=1.0
// reject  → upsert matched_by='manual_negative', confidence=0.0
```

- [ ] **Step 2:** `PostCard` menu kebab — lista topics do user. Clicar "Marcar: Anitta" → POST action=confirm. Outro menu "Este post NÃO é sobre..." → action=reject.

- [ ] **Step 3:** Smoke test + commit `feat(gossip): feedback loop (tag-topic manual)`.

---

### Task 19: Cron diário

**Files:**
- Create: `src/app/api/cron/gossip-daily/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: route**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { collectGossipForUser } from "@/lib/gossip/collector";
import { generateDossiersForUser } from "@/lib/gossip/dossier";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: users } = await admin
    .from("gossip_sources")
    .select("user_id")
    .eq("active", true);
  const userIds = Array.from(new Set((users ?? []).map((r) => r.user_id)));

  const results: Array<{ user_id: string; inserted: number; dossiers: number; errors: string[] }> = [];
  for (const uid of userIds) {
    try {
      const report = await collectGossipForUser(admin, uid);
      const dossiers = await generateDossiersForUser(admin, uid);
      results.push({ user_id: uid, inserted: report.inserted, dossiers: dossiers.length, errors: report.errors });
    } catch (err) {
      results.push({ user_id: uid, inserted: 0, dossiers: 0, errors: [String(err)] });
    }
  }

  return NextResponse.json({ ok: true, usersProcessed: results.length, results });
}

export const maxDuration = 300;
```

**Atenção:** aqui usa `SUPABASE_SERVICE_ROLE_KEY` porque precisa iterar todos usuários. Bypassa RLS — código deve filtrar manualmente por `user_id`.

- [ ] **Step 2: `vercel.json`**

```json
{
  "crons": [
    ...existentes,
    { "path": "/api/cron/gossip-daily", "schedule": "0 11 * * *" }
  ]
}
```

- [ ] **Step 3: Smoke test local**

```bash
curl -H "Authorization: Bearer <CRON_SECRET do .env.local>" http://localhost:3000/api/cron/gossip-daily
```

Expected: 200, JSON com `usersProcessed` e `results`.

- [ ] **Step 4: Commit** `feat(gossip): cron diário (collect + dossiers)`.

---

## Phase 4 — Enriquecimento

### Task 20: suggest-aliases endpoint

**Files:**
- Create: `src/lib/gossip/aliases.ts`
- Create: `src/app/api/gossip/topics/suggest-aliases/route.ts`

- [ ] **Step 1: `aliases.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { GossipTopicType } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function suggestAliases(name: string, type: GossipTopicType): Promise<string[]> {
  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `Você ajuda a identificar variações de um nome/entidade em posts de fofoca.
Dado "${name}" (tipo: ${type}), liste 4-8 variantes (apelidos, abreviações, handles @, grafias alternativas) que podem aparecer em posts BR e internacionais.
Não inclua nomes de família genéricos ("Silva", "Santos"). Não inclua palavras com < 3 chars.
Retorne JSON: {"aliases": ["...", "..."]}.`,
    }],
  });
  const text = res.content[0]?.type === "text" ? res.content[0].text : "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return [name.toLowerCase()];
  try {
    const parsed = JSON.parse(m[0]) as { aliases?: string[] };
    const normalized = [name.toLowerCase(), ...((parsed.aliases ?? []).map((a) => a.toLowerCase()))];
    return Array.from(new Set(normalized)).filter((a) => a.length >= 3);
  } catch {
    return [name.toLowerCase()];
  }
}
```

- [ ] **Step 2: route**

POST body `{ name, type }` → retorna `{ aliases: string[] }`.

- [ ] **Step 3: Integrar em `TopicFormModal`**

Campo "Aliases" tem botão "✨ Sugerir" que chama o endpoint e preenche chips editáveis.

- [ ] **Step 4:** Browser smoke test com "Virgínia Fonseca" — verifica aliases plausíveis.

- [ ] **Step 5:** Commit `feat(gossip): suggest-aliases via Claude`.

---

### Task 21: Templates curados de sources

**Files:**
- Create: `src/lib/gossip/templates.ts`

- [ ] **Step 1: templates.ts**

```ts
import type { GossipPlatform, GossipSourceTier } from "./types";

export interface SourceTemplate {
  platform: GossipPlatform;
  handle: string;
  label: string;
  tier: GossipSourceTier;
  region: "br" | "int";
  category: "tabloid" | "proxy" | "community" | "video";
}

export const SOURCE_TEMPLATES: SourceTemplate[] = [
  // RSS BR — primary
  { platform: "rss", handle: "https://revistaquem.globo.com/rss/ultimas/feed.xml", label: "Quem", tier: "primary", region: "br", category: "tabloid" },
  { platform: "rss", handle: "https://ego.globo.com/rss/ultimas.xml", label: "Ego/Gshow", tier: "primary", region: "br", category: "tabloid" },
  { platform: "rss", handle: "https://f5.folha.uol.com.br/rss.xml", label: "F5/UOL", tier: "primary", region: "br", category: "tabloid" },
  { platform: "rss", handle: "https://www.purepeople.com.br/rss.xml", label: "Purepeople BR", tier: "primary", region: "br", category: "tabloid" },
  { platform: "rss", handle: "https://contigo.uol.com.br/rss.xml", label: "Contigo", tier: "primary", region: "br", category: "tabloid" },
  // RSS INT — primary
  { platform: "rss", handle: "https://www.tmz.com/rss.xml", label: "TMZ", tier: "primary", region: "int", category: "tabloid" },
  { platform: "rss", handle: "https://pagesix.com/feed/", label: "Page Six", tier: "primary", region: "int", category: "tabloid" },
  { platform: "rss", handle: "https://www.dailymail.co.uk/tvshowbiz/index.rss", label: "Daily Mail Showbiz", tier: "primary", region: "int", category: "tabloid" },
  { platform: "rss", handle: "https://www.eonline.com/syndication/rss/news.xml", label: "E! News", tier: "primary", region: "int", category: "tabloid" },
  { platform: "rss", handle: "https://people.com/feed/", label: "People", tier: "primary", region: "int", category: "tabloid" },
  // Twitter BR — proxy
  { platform: "twitter", handle: "hugogloss", label: "Hugo Gloss", tier: "proxy", region: "br", category: "proxy" },
  { platform: "twitter", handle: "choquei", label: "Choquei", tier: "proxy", region: "br", category: "proxy" },
  { platform: "twitter", handle: "gossipdodia", label: "Gossip do Dia", tier: "proxy", region: "br", category: "proxy" },
  { platform: "twitter", handle: "portalfamosos", label: "Portal Famosos", tier: "proxy", region: "br", category: "proxy" },
  // Twitter INT — proxy
  { platform: "twitter", handle: "PopCrave", label: "Pop Crave", tier: "proxy", region: "int", category: "proxy" },
  { platform: "twitter", handle: "DeuxMoi", label: "DeuxMoi", tier: "proxy", region: "int", category: "proxy" },
  { platform: "twitter", handle: "PopBase", label: "Pop Base", tier: "proxy", region: "int", category: "proxy" },
  { platform: "twitter", handle: "PopTingz", label: "Pop Tingz", tier: "proxy", region: "int", category: "proxy" },
  // YouTube — primary
  { platform: "youtube", handle: "UC...", label: "Matheus Mazzafera", tier: "primary", region: "br", category: "video" },
  // ^ channel IDs reais resolvidos na implementação via fetchYouTubeChannel resolver
  // Reddit — aggregator
  { platform: "reddit", handle: "r/Fauxmoi", label: "r/Fauxmoi", tier: "aggregator", region: "int", category: "community" },
  { platform: "reddit", handle: "r/popculturechat", label: "r/popculturechat", tier: "aggregator", region: "int", category: "community" },
  { platform: "reddit", handle: "r/BBB", label: "r/BBB", tier: "aggregator", region: "br", category: "community" },
  { platform: "reddit", handle: "r/brasil", label: "r/brasil", tier: "aggregator", region: "br", category: "community" },
];
```

Antes de commitar, **validar cada URL RSS** com `curl -sI <url>` pra confirmar 200. Remover ou atualizar as que não respondem. Channel IDs reais de YouTube via `https://www.youtube.com/@channelname` → ver source code → `channelId`.

- [ ] **Step 2:** Commit `feat(gossip): templates curados de sources`.

---

### Task 22: OnboardingWizard `/gossip/new`

**Files:**
- Create: `src/app/gossip/new/page.tsx`
- Create: `src/components/gossip/OnboardingWizard.tsx`

- [ ] **Step 1: Wizard 2 steps**

- Step 1 — "Escolha suas fontes": grid de `SOURCE_TEMPLATES` agrupado por `region` + filtro por `category`. User marca checkboxes. Validação: ≥3 selecionadas pra habilitar "Continuar".
- Step 2 — "Quem você acompanha?": input `name` + select `type`. Ao digitar (debounce 600ms) + blur, chama `/api/gossip/topics/suggest-aliases` e mostra aliases como chips editáveis. User adiciona até 5 topics (card lateral acumulando). Botão "Finalizar" → POST cada source + topic + redirect `/gossip`.

- [ ] **Step 2: Guard de redirect**

No `/gossip/page.tsx`, se user tem 0 sources, redirect pra `/gossip/new`.

- [ ] **Step 3:** Smoke test end-to-end: criar conta fresca → `/gossip` → redirect → finalizar wizard → ver feed sendo coletado.

- [ ] **Step 4:** Commit `feat(gossip): onboarding wizard`.

---

## Phase 5 — Polimento

### Task 23: Topic detail page — timeline histórica

**Files:**
- Create: `src/app/gossip/[topicId]/page.tsx`

- [ ] **Step 1: Página**

Fetch `/api/gossip/topics/{id}` (PATCH-existente retorna GET? Se não, criar GET) + `/api/gossip/topics/{id}/dossiers?limit=30`.

Layout:
- Header: foto + nome + type + priority + botão edit/remove.
- Timeline: lista de dossiers por data (mais recente topo). Cada item colapsável — fechado mostra data + summary truncado; aberto mostra summary completo + key_quotes com link.

- [ ] **Step 2:** Smoke test — clicar num DossierCard na home de gossip abre a timeline.

- [ ] **Step 3:** Commit `feat(gossip): topic detail com timeline histórica`.

---

### Task 24: Cron de retention

**Files:**
- Create: `src/app/api/cron/gossip-retention/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Route**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const cutoff = new Date(Date.now() - 90 * 24 * 3600_000).toISOString().slice(0, 10);
  const { count, error } = await admin
    .from("gossip_dossiers")
    .delete({ count: "exact" })
    .lt("date", cutoff);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
```

- [ ] **Step 2: `vercel.json`**

```json
{ "path": "/api/cron/gossip-retention", "schedule": "0 5 * * 0" }
```

- [ ] **Step 3:** Smoke test local + commit `feat(gossip): cron retention semanal`.

---

### Task 25: Empty states + loading + toast de progresso

**Files:**
- Modify: `src/app/gossip/page.tsx`, `src/components/gossip/DossierGrid.tsx`, `FeedList.tsx`, `OnboardingWizard.tsx`

- [ ] **Step 1: Empty states**

- Sem sources: redirect pra `/gossip/new` (já feito — verificar).
- Sem topics: card "Adicione quem você quer acompanhar" no lugar da grid.
- Sem posts ainda: "Coletando suas primeiras fofocas — pode demorar até 1 minuto."

- [ ] **Step 2: Loading skeletons**

Nos cards e na lista, placeholders com `animate-pulse`.

- [ ] **Step 3: Toast de collect**

Ao clicar "Atualizar agora", toast "Buscando em X fontes..." → depois "Y posts novos / Z erros".

- [ ] **Step 4:** Smoke test + commit `feat(gossip): empty/loading states + toasts`.

---

### Task 26: Smoke test end-to-end + deploy

- [ ] **Step 1: Build local**

```bash
npm run build
```

Expected: sucesso. Se houver erro de typecheck, corrigir.

- [ ] **Step 2: Checklist manual (browser)**

- [ ] Criar topic "Anitta" com aliases sugeridos por IA
- [ ] Adicionar 3 sources via onboarding (Quem RSS + Hugo Gloss + r/popculturechat)
- [ ] Clicar "Atualizar agora" — ver posts aparecerem
- [ ] Ver dossier de Anitta gerado (com spike badge se aplicável)
- [ ] Abrir timeline do topic
- [ ] Marcar um post manualmente como relacionado a Anitta
- [ ] Marcar um post como "não é sobre Anitta"
- [ ] Rodar `/api/cron/gossip-daily` manual via curl + verificar log
- [ ] Aba Gossip aparece no ModeNav ao lado de Brands

- [ ] **Step 3: Commit final + push + deploy**

```bash
git push origin master    # dispara Vercel auto-deploy
```

Verificar deploy no Vercel dashboard.

- [ ] **Step 4: Envs no Vercel**

Confirmar que `ANTHROPIC_API_KEY`, `CRON_SECRET`, `TAVILY_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` já existem em Produção. Se falta algo, `vercel env add`.

- [ ] **Step 5: Smoke test em prod**

Abrir `https://jay-news.vercel.app/gossip` (ou URL atual). Repetir checklist do Step 2 em prod.

---

## Resumo de commits esperados

```
feat(gossip): migration 019 — sources, posts, topics, dossiers + RLS
feat(gossip): types de domínio
feat(gossip): rss fetcher para portais
feat(gossip): wrappers de fetcher (twitter/youtube/reddit) sobre src/lib/social
feat(gossip): collector orquestrando fetchers + upsert
feat(gossip): api sources (CRUD)
feat(gossip): api topics (CRUD)
feat(gossip): aba no ModeNav
feat(gossip): página base /gossip
feat(gossip): feed endpoint + FeedList/PostCard/FeedFilters
feat(gossip): SettingsDrawer + modais de source/topic
feat(gossip): collect endpoint + botão atualizar
feat(gossip): matcher camada 1 (alias regex)
feat(gossip): matcher camada 2 (claude classifier)
feat(gossip): spike score calculator
feat(gossip): dossier generator (Haiku)
feat(gossip): dossier endpoints + DossierGrid/Card
feat(gossip): feedback loop (tag-topic manual)
feat(gossip): cron diário (collect + dossiers)
feat(gossip): suggest-aliases via Claude
feat(gossip): templates curados de sources
feat(gossip): onboarding wizard
feat(gossip): topic detail com timeline histórica
feat(gossip): cron retention semanal
feat(gossip): empty/loading states + toasts
```

**26 commits · 5 fases · ~4 dias de dev focado.**

## Riscos operacionais conhecidos

- **RSS instáveis:** portais BR (UOL, Folha) mudam URL com frequência. Validar cada URL no Task 21 antes de commitar templates. Adicionar fallback (404 → marcar source como `active=false` com erro no banco) é Fase 6, não escopo desse plano.
- **Claude alucina fato no dossier:** system prompt proíbe, e `key_quotes` obriga citar fonte. Mas não há auto-check. Adicionar "verificador" em Fase 2.
- **Supabase count exact** em tabelas grandes fica lento. O `calcSpikeForTopic` usa `count: "exact"` — OK por enquanto (tabela vazia na GA), mas virar issue quando >100k posts.
- **Rate limit Tavily**: em dia com 50+ sources twitter, pode estourar. O wrapper `fetchTwitterHandle` de `src/lib/social` já controla — confirmar.
