# Aba Gossip — Design Spec

**Data:** 2026-04-17
**Status:** Aprovado em brainstorming — aguardando spec review
**Autor:** Claude Opus 4.7 (1M) + Gabriel

## Contexto

A plataforma Jay News já tem 7 abas (News, Trends, Markets, Trading, Social, Brands, Consulta). Falta uma aba dedicada a fofoca/entretenimento que combine:

- **Acompanhamento de fontes** (portais, perfis) — como News/Social.
- **Acompanhamento de pessoas/temas específicos** — como Trends.

Posicionamento: aba **Gossip** é infraestrutura genérica, configurada por usuário, cobrindo fofoca brasileira e internacional de forma híbrida. Não é opinada editorialmente; o app dá as ferramentas e templates, o user escolhe quem acompanhar.

## Decisões de escopo (fechadas em brainstorming)

| Decisão | Escolha |
|---------|---------|
| Foco geográfico | Híbrido BR + internacional, user-driven |
| Modelo de entidades | Topics genéricos tagueáveis (`person`, `couple`, `event`, `show`, `brand`) |
| Fontes | RSS portais + Twitter + YouTube + Reddit + "proxies" de IG via Twitter (Choquei, Pop Crave, DeuxMoi) — **sem scrape direto de IG/TikTok** |
| Modelo de feed | Feed cronológico + cards de **Dossiê** por topic acompanhado |
| Cadência | Cron diário (08h BRT) + botão de refresh manual por topic |
| Arquitetura | Namespace próprio `gossip_*` (tabelas novas), fetchers reutilizam código de `src/lib/social` via import/wrapping |

## Arquitetura geral

```
┌─ gossip_sources ─┐        ┌─ gossip_posts ─┐       ┌─ gossip_post_topics ─┐       ┌─ gossip_topics ─┐
│  RSS  │ Twitter  │  ─────>│  url, author,  │──────>│  post_id ↔ topic_id  │<──────│ person/couple/ │
│  YT   │ Reddit   │        │  body, img...  │       │  confidence, source  │       │ event/show     │
└──────────────────┘        └────────────────┘       └──────────────────────┘       └─────────────────┘
                                                                                             │
                                                                                             ▼
                                                                                  ┌─ gossip_dossiers ─┐
                                                                                  │ topic_id + date  │
                                                                                  │ summary, quotes, │
                                                                                  │ spike_score      │
                                                                                  └──────────────────┘
```

### Fluxo operacional

1. **Collector** roda 1x/dia às 08h BRT via Vercel cron.
   - Varre todos os usuários ativos (que já usaram Gossip ao menos 1x).
   - Para cada user, coleta posts novos de cada `gossip_source` ativa.
2. **Topic matcher** processa cada post novo e liga a topics do user (duas camadas — ver §3).
3. **Dossier generator** roda logo depois do matcher.
   - Para cada topic do user com ≥1 post novo nas últimas 24h, gera dossiê com Claude Haiku 4.5.
4. **Spike scorer** atualiza `spike_score` de cada topic (posts_24h / média_móvel_7d).
5. **UI** exibe cards de topic + feed cronológico. Botões de refresh manual re-disparam o pipeline para um topic específico.

## Data model — Migration 019

```sql
-- ===== Fontes =====
CREATE TABLE gossip_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  platform TEXT NOT NULL CHECK (platform IN ('rss', 'twitter', 'youtube', 'reddit')),
  handle TEXT NOT NULL,           -- URL RSS, @handle, channel_id, ou subreddit/user
  label TEXT NOT NULL,            -- nome display: "Hugo Gloss", "TMZ", "r/Fauxmoi"
  tier TEXT NOT NULL DEFAULT 'primary'
    CHECK (tier IN ('primary', 'proxy', 'aggregator')),
  active BOOLEAN NOT NULL DEFAULT true,

  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, platform, handle)
);
CREATE INDEX idx_gossip_sources_user_active ON gossip_sources(user_id, active);

-- ===== Posts =====
CREATE TABLE gossip_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES gossip_sources(id) ON DELETE CASCADE,

  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,      -- guid RSS, tweet_id, video_id, reddit post id
  url TEXT NOT NULL,
  author TEXT,
  title TEXT,
  body TEXT,
  image_url TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  raw JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, platform, external_id)
);
CREATE INDEX idx_gossip_posts_user_published ON gossip_posts(user_id, published_at DESC);
CREATE INDEX idx_gossip_posts_source ON gossip_posts(source_id, published_at DESC);

-- ===== Topics (entidades editoriais) =====
CREATE TABLE gossip_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN ('person', 'couple', 'event', 'show', 'brand')),
  name TEXT NOT NULL,             -- "Anitta", "Virginia + Zé Felipe", "BBB 25"
  aliases TEXT[] NOT NULL DEFAULT '{}',  -- variantes pro matcher (lowercased)
  image_url TEXT,
  priority SMALLINT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,  -- tmdb_id, wikipedia_url, etc.

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, name)
);
CREATE INDEX idx_gossip_topics_user_active ON gossip_topics(user_id, active);

-- ===== Post ↔ Topic (N:N) =====
CREATE TABLE gossip_post_topics (
  post_id UUID NOT NULL REFERENCES gossip_posts(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES gossip_topics(id) ON DELETE CASCADE,

  confidence REAL NOT NULL DEFAULT 1.0,      -- 0..1
  matched_by TEXT NOT NULL CHECK (matched_by IN ('alias', 'claude', 'manual', 'manual_negative')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (post_id, topic_id)
);
CREATE INDEX idx_gossip_post_topics_topic ON gossip_post_topics(topic_id, created_at DESC);

-- ===== Dossiês =====
CREATE TABLE gossip_dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES gossip_topics(id) ON DELETE CASCADE,

  date DATE NOT NULL,
  summary TEXT NOT NULL,
  key_quotes JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{text, source_label, url}]
  spike_score REAL NOT NULL DEFAULT 0,              -- 0..∞ (1.0 = volume normal)
  spike_level TEXT NOT NULL DEFAULT 'low'
    CHECK (spike_level IN ('low', 'medium', 'high')),
  post_ids UUID[] NOT NULL DEFAULT '{}',

  model TEXT,
  input_tokens INT,
  output_tokens INT,
  cost_cents REAL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, topic_id, date)
);
CREATE INDEX idx_gossip_dossiers_user_date ON gossip_dossiers(user_id, date DESC);
CREATE INDEX idx_gossip_dossiers_topic_date ON gossip_dossiers(topic_id, date DESC);

-- ===== RLS =====
ALTER TABLE gossip_sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gossip_posts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE gossip_topics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gossip_post_topics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gossip_dossiers     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gossip_sources_all_own" ON gossip_sources FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "gossip_posts_all_own" ON gossip_posts FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "gossip_topics_all_own" ON gossip_topics FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "gossip_dossiers_all_own" ON gossip_dossiers FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "gossip_post_topics_via_post" ON gossip_post_topics FOR ALL
  USING (post_id IN (SELECT id FROM gossip_posts WHERE user_id = auth.uid()))
  WITH CHECK (post_id IN (SELECT id FROM gossip_posts WHERE user_id = auth.uid()));

-- ===== Triggers touch =====
CREATE OR REPLACE FUNCTION touch_gossip() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gossip_sources_touch  BEFORE UPDATE ON gossip_sources  FOR EACH ROW EXECUTE FUNCTION touch_gossip();
CREATE TRIGGER gossip_topics_touch   BEFORE UPDATE ON gossip_topics   FOR EACH ROW EXECUTE FUNCTION touch_gossip();
```

## §3 Matching post ↔ topic

Duas camadas, em ordem:

### Camada 1 — Alias match (regex, grátis)

Para cada post novo, faz case-insensitive search em `title + body` por cada alias de cada topic ativo do user. Match → insert em `gossip_post_topics` com `matched_by='alias'` e `confidence=1.0`.

**Cobre ~80% dos casos.** Importante: `aliases` é pré-populado com boas variantes na criação do topic (ver §4 — melhoria #2).

### Camada 2 — Claude classifier (só borderline)

Se o post menciona **nomes próprios** (detecção simples: palavras Capitalizadas em sequência, `2+ palavras`) mas NÃO bateu em nenhum alias, e o user tem topics ativos que podem estar relacionados (por exemplo o post vem de uma `source` com `tier='proxy'` ou `tier='aggregator'`), roda 1 call Haiku:

```
Pergunta: "Este post menciona qualquer pessoa da lista?"
Input: título + body + lista de [{topic_id, type, name, aliases}]
Output: [{topic_id, confidence}] ou []
```

Matches com `confidence >= 0.6` entram em `gossip_post_topics` com `matched_by='claude'`. Cap de 1 call por post — evita loop de custo.

### Feedback loop (melhoria #4 aprovada)

UI expõe duas ações por post:
- **"Marcar como relacionado a X"** → insert com `matched_by='manual'`, `confidence=1.0`.
- **"Esse post NÃO é sobre Y"** → insert com `matched_by='manual_negative'`, `confidence=0.0`.

O dossiê generator ignora posts com `manual_negative` para o topic em questão. Futuramente (fase 2), os pares negativos alimentam o prompt do classifier pra ele aprender exemplos.

## §4 Dossiê IA — Claude Haiku 4.5

### Geração

Para cada topic do user com ≥1 post novo nas últimas 24h (excluindo `manual_negative`), gera dossiê:

```
SYSTEM:
Você é redator de fofoca brasileira. Escreve curto, direto, tom pop-news.
Não inventa fato nenhum — só o que está nos posts. Se não há fato novo, diz
explicitamente "dia calmo, sem novidade".

USER:
Topic: {topic.name} ({topic.type})
Posts das últimas 24h (ordenados por data):
[{source_label} | {author} | "{title}" | {body[:400]} | {url}]
...

Retorne JSON:
{
  "summary": "3-5 linhas em português informal",
  "key_quotes": [{"text": "...", "source_label": "...", "url": "..."}],
  "spike_level": "low" | "medium" | "high",
  "post_ids_used": ["uuid", ...]  // subset dos posts acima
}
```

### Custo estimado (Haiku 4.5 @ $1/M in, $5/M out)

- Dossiê típico: ~2k input tokens + 500 output = **$0.004/topic/dia**.
- User com 10 topics = **$0.04/dia = $1.2/mês/user**.
- Cap: usuário pode ter no máximo 30 topics ativos (hard limit no API).

### Dossiê histórico (melhoria #5 aprovada)

`gossip_dossiers` guarda 1 linha por (user, topic, date). Ao abrir a página de um topic, UI mostra timeline dos últimos 30 dias — cada dia colapsável, mostrando summary. Vira uma mini-biografia editorial acumulada.

### Retention

90 dias. Cron semanal `/api/cron/gossip-retention` (schedule `0 5 * * 0`, domingo 05h UTC / 02h BRT) faz `DELETE FROM gossip_dossiers WHERE date < now() - interval '90 days'`. Auth via `CRON_SECRET`. Registrada em `vercel.json` junto com o cron diário.

## §5 Spike indicator (melhoria #1 aprovada)

Cálculo simples no final do collector:

```python
posts_24h = count(posts where topic_id matched AND published_at > now - 24h)
avg_7d = avg(posts_24h do mesmo topic em cada um dos últimos 7 dias)
spike_score = posts_24h / max(avg_7d, 0.5)   # evita divisão por 0

if spike_score >= 3.0:  spike_level = 'high'
elif spike_score >= 1.5: spike_level = 'medium'
else: spike_level = 'low'
```

Exibição:
- `high` → badge 🔥 vermelho no card do topic
- `medium` → badge 📈 amarelo
- `low` → sem badge

Zero custo incremental — é query sobre posts que já foram coletados.

## §6 Sources curadas — templates iniciais

Apresentados no wizard de onboarding (`/gossip/new`). Divididos em 3 grupos geográficos/tier.

Todo template carrega `tier` pré-definido — essencial porque a camada 2 do matcher (§3) só roda em posts cuja fonte tem `tier IN ('proxy','aggregator')`. Tier errado = classifier nunca dispara.

### RSS — tier `primary` (portais oficiais)

**BR:** Quem, Ego/Gshow, F5/UOL Celebridades, Purepeople BR, Contigo

**INT:** TMZ, Page Six (NY Post), Daily Mail Showbiz, E! News, People

### Twitter — tier `proxy` (repostam IG/TikTok com velocidade)

**BR:** `@hugogloss`, `@choquei`, `@gossipdodia`, `@portalfamosos`

**INT:** `@PopCrave`, `@DeuxMoi`, `@PopBase`, `@PopTingz`

### YouTube — tier `primary`

Matheus Mazzafera, Foquinha, WayneBeck Reacts, PodDelas

### Reddit — tier `aggregator` (comunidade discute e agrega tudo)

`r/Fauxmoi`, `r/popculturechat`, `r/BBB`, `r/brasil`

Claude Haiku sugere subset dessas fontes no onboarding baseado em respostas simples ("acompanha mais BR, internacional ou os dois?", "gosta mais de tabloide, comunidade ou insider?").

## §7 Geração automática de aliases (melhoria #2 aprovada)

No momento em que o user cria um topic, o form faz POST pra `/api/gossip/topics/suggest-aliases`:

```
Input: { name: "Virgínia Fonseca", type: "person" }
Output: { aliases: ["Virginia Fonseca", "Virginia", "virgi", "@virginia", "Virgínia Zé", "V. Fonseca"] }
```

Prompt do Haiku:
```
Você ajuda a identificar variações de um nome/entidade em posts de fofoca.
Dado "{name}" ({type}), liste 4-8 variantes (apelidos, abreviações, handles
prováveis, grafias alternativas) que podem aparecer em posts BR e gringo.
NÃO inclua nomes de família genéricos. Retorne JSON: {"aliases": [...]}.
```

User pode editar (add/remove) o array antes de salvar. Aliases são sempre armazenadas lowercased. Custo: ~200 tokens = $0.0003 por topic criado. Trivial.

## §8 API routes

```
GET     /api/gossip/sources               lista fontes do user
POST    /api/gossip/sources               cria fonte (body: platform, handle, label, tier)
PATCH   /api/gossip/sources/:id           toggle active, edita label/tier
DELETE  /api/gossip/sources/:id

GET     /api/gossip/topics                lista topics
POST    /api/gossip/topics                cria topic
POST    /api/gossip/topics/suggest-aliases    gera aliases via Claude
PATCH   /api/gossip/topics/:id            edita name/aliases/priority/active
DELETE  /api/gossip/topics/:id

GET     /api/gossip/feed?topic_id&source_id&since   feed filtrado (últimos N posts)
POST    /api/gossip/posts/:id/tag-topic       body: {topic_id, action: 'confirm'|'reject'}
        # action=confirm  → INSERT/UPDATE (post_id, topic_id) matched_by='manual',           confidence=1.0
        # action=reject   → INSERT/UPDATE (post_id, topic_id) matched_by='manual_negative', confidence=0.0

POST    /api/gossip/collect                   refresh geral do user (collect + match + dossiês)
POST    /api/gossip/topics/:id/refresh        refresh manual de um topic específico

GET     /api/gossip/dossiers?date             dossiês do dia (default: hoje)
GET     /api/gossip/topics/:id/dossiers       histórico do topic (30 dias)

GET     /api/cron/gossip-daily                cron diário, auth via CRON_SECRET
```

## §9 UI — página `/gossip`

Usa `AppHeader` + `ModeNav` existentes (aba Gossip já deveria ser adicionada ao ModeNav; ícone sugerido: `Sparkles` ou `Flame`).

### Layout

```
┌────────────────────────────────────────────────────────┐
│  AppHeader  [Atualizar agora]  [+ Settings (drawer)]   │
├────────────────────────────────────────────────────────┤
│  Dossiês de hoje                                       │
│  ┌──────┐  ┌──────┐  ┌──────┐                          │
│  │Anitta│  │BBB 25│  │Taylor│   ← cards de topic       │
│  │🔥 high│  │📈 med│  │  low │                          │
│  │resumo│  │resumo│  │resumo│                          │
│  │[refresh]  [refresh]  [refresh]                      │
│  └──────┘  └──────┘  └──────┘                          │
├────────────────────────────────────────────────────────┤
│  Feed [chip: todos] [chip: topic] [chip: source]       │
│  • Hugo Gloss · 10min: "..."                           │
│  • Choquei · 25min: "..."                              │
│  • TMZ · 1h: "..."                                     │
│  ...                                                    │
└────────────────────────────────────────────────────────┘
```

### Componentes

- `GossipHeader` — botão refresh geral + settings drawer trigger.
- `DossierGrid` — grid responsivo de `DossierCard`s (2 cols mobile, 3 desktop).
- `DossierCard` — foto do topic + nome + badge spike + summary + botão refresh manual. Clicável → abre modal/drawer com **timeline histórica** (melhoria #5) e key_quotes.
- `FeedFilters` — chips para filtrar por topic/source.
- `FeedList` — lista cronológica de `PostCard`s.
- `PostCard` — thumb + fonte + author + snippet + link externo + menu "marcar relacionado a..." / "não é sobre...".
- `SettingsDrawer` — abas "Fontes" e "Topics" com CRUD por modal, estilo Social.

### Onboarding (`/gossip/new`)

Wizard 2-steps:
1. **Escolha suas fontes** — grid de templates agrupados por tier, user marca checkbox. "Pule" desabilitado até marcar ≥3.
2. **Quem você acompanha?** — input de nome + type picker (person/couple/event/show/brand). Ao digitar, Claude sugere aliases em tempo real. User adiciona até 5 topics pra começar.

Ao completar, redireciona pra `/gossip` com toast "Coletando suas primeiras fofocas...". Collector dispara em background.

## §10 Cron job

```
GET /api/cron/gossip-daily       (Vercel cron, header X-Cron-Secret)
GET /api/cron/gossip-retention   (Vercel cron semanal, purge de dossiers > 90d)
```

`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/gossip-daily",     "schedule": "0 11 * * *" },
    { "path": "/api/cron/gossip-retention", "schedule": "0 5  * * 0" }
  ]
}
```

`0 11 * * *` UTC = 08h BRT diário. `0 5 * * 0` UTC = 02h BRT domingo.

**Runtime:** ambas as routes são Node (Fluid Compute). Timeout `maxDuration: 300` (default do plan atual já permite). Em caso de estouro no futuro, particionar o daily por batches de users e disparar em paralelo ao invés de sequencial.

Execução:
1. Busca todos os users que têm ≥1 `gossip_source` ativa.
2. Para cada user, em sequência (não paraleliza usuários — evita rate limit APIs):
   - Roda `collectForUser(user_id)` — fetch em paralelo das fontes.
   - Dedup via unique constraint.
   - Roda `matchAllNewPosts(user_id)` — camadas 1 + 2.
   - Roda `generateDossiersForUser(user_id)` — 1 call Haiku por topic com posts novos.
3. Loga métricas (`gossip_dossiers.cost_cents` soma).

Timeout da function: default 300s é suficiente pra ~50 users × 10 topics × 1s cada.

## §11 APIs externas avaliadas

| API | Uso | Custo | Decisão |
|-----|-----|-------|---------|
| Tavily (já no projeto) | Twitter/X fetch | já pago | ✅ reusar |
| RSS portais | Feed oficial direto | grátis | ✅ |
| Reddit JSON `/.json` | Subs + users | grátis | ✅ |
| YouTube RSS | Canais | grátis | ✅ |
| Claude Haiku 4.5 | Aliases + classifier + dossiê | ~$1–3/user/mês | ✅ |
| TMDB (themoviedb.org) | Enriquece topic person/show com foto | grátis, 40 req/10s | ✅ adicionar em fase 4 |
| Wikipedia REST | Disambig + foto fallback | grátis | ✅ fase 4 |
| SerpAPI / Bing News | Busca ad-hoc | $50+/mês | ⚠️ skip no MVP |
| Apify / ScrapingBee | Scrape IG/TikTok | $30–100/mês | ❌ descartado |

## §12 Fases de entrega

| Fase | Escopo | Tempo |
|------|--------|-------|
| **1. Fundação** | Migration 019. `src/lib/gossip/` base (types, rss-fetcher novo, wrappers de twitter/youtube/reddit). APIs CRUD de sources+topics. ModeNav atualizado com aba Gossip. | 1 dia |
| **2. UI básica** | `/gossip` page. SettingsDrawer com CRUD. Feed cronológico com filtros. Collect manual. | 1 dia |
| **3. Matching + dossiê** | Topic matcher 2-camadas. Dossier generator (Claude). Cron diário. Feedback loop (tag-topic endpoint + UI actions). | 1 dia |
| **4. Enriquecimento** | suggest-aliases endpoint. TMDB/Wikipedia metadata. Templates curados no onboarding. Wizard `/gossip/new`. | 0.5 dia |
| **5. Polimento** | Spike indicator (cálculo + UI). DossierCard com timeline histórica. Empty states. Toast de progresso do collect. | 0.5 dia |

**Total: ~4 dias de dev focado.**

## §13 Melhorias aprovadas (1, 2, 4, 5)

- **#1 Spike indicator** — §5
- **#2 Aliases sugeridas por IA** — §7
- **#4 Feedback loop de matching** — §3 (camada manual)
- **#5 Dossiê histórico** — §4 (retention 90d, timeline na UI)

Melhorias #3 (topic temporal), #6 (compartilhar dossiê público) e #7 (packs sazonais) ficam fora do escopo desta spec.

## Riscos & mitigações

| Risco | Mitigação |
|-------|-----------|
| Rate limit Tavily em dia cheio | Throttle no wrapper social de Twitter (já existe); limite de 50 sources ativas por user |
| Match falso-positivo (post sobre "Kim Kardashian" matched com topic "Kim" curto) | Aliases devem ser ≥3 chars; no Claude classifier, prompt exige `confidence >= 0.6` |
| Claude dossier alucina fato não presente nos posts | Prompt explicitamente proíbe invenção; system prompt reforça; fase 2 pode adicionar auto-check via segunda call |
| Custo Claude escapa com topics populares (BBB 25 com 500 posts/dia) | Cap no dossier: posts ordenados por source tier + recency, top 40 entram no prompt |
| RSS de portal BR instável (Quem/UOL derrubam feed) | Pipeline é tolerante a falha por source — um RSS caído não para o resto |
| Privacy/moderação — user adiciona topic sobre menor de idade | Fora de escopo. Documentar em Terms; possível filtro básico em v2 |

## Métricas de sucesso pós-MVP

- % de users que abrem Gossip ≥3 dias/semana após onboarding.
- Médio de topics ativos por user (espera-se 5–12).
- % de dossiês com `spike_level != 'low'` — indica se o sinal/ruído tá calibrado.
- Custo médio Claude/user/mês (alvo: < $2).
- NPS qualitativo em entrevista breve com 3–5 users após 2 semanas.
