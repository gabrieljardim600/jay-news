# jay-news /api/v1 — referência

API M2M consumida por outros produtos (`social` é o primeiro). Todas as rotas
v1 vivem em `https://jay-news.vercel.app/api/v1/...` e exigem service auth.

## Auth

Cada request precisa destes headers:

| Header | Obrigatório | Descrição |
|---|---|---|
| `X-Service` | sempre | Slug do consumidor (`social`). |
| `X-Service-Key` | sempre | Chave plain do `news_services.key_hash` (bcrypt). Plain vive em `keys.md`. |
| `X-Account-Id` | rotas escopadas | UUID da `accounts.id` no consumidor. |
| `X-User-Id` | writes | UUID do `auth.users.id` que disparou. |
| `X-User-Role` | recomendado | `viewer` \| `editor` \| `owner`. Default `editor`. |
| `X-Request-Id` | opcional | UUID pra tracing cross-repo. |

**Status codes esperados:**
- `200` — OK
- `400` — body / headers inválidos (account_id mal formado, X-User-Id faltando em writes, etc.)
- `401` — service key inválida ou inativa
- `403` — `X-User-Role` insuficiente
- `404` — recurso fora da account
- `500` — erro do upstream (Tavily/Claude/etc.)

**Modelo de isolamento:** rotas v1 usam `service_role` no Supabase
(bypassa RLS) + helper `byAccount(query, ctx)` que injeta `.eq('account_id', ctx.account_id)`.
Audit RLS via `scripts/v1-smoke.sh`.

## Endpoints

### Health

- `GET /health` — echo do contexto de auth.

### Digests

- `GET /digests?limit&cursor&digest_config_id&from&to` — list paginated por cursor `(generated_at, id)`.
- `POST /digests/generate` — body `{ digest_config_id }`. Retorna `{ digest_id, status: 'queued' }`. Pipeline async via `after()`. **Custo IA real** (Tavily + Claude).
- `GET /digests/:id` — `{ digest, articles, highlights, alert_articles, by_topic }`.
- `GET /digests/:id/progress` — `{ digest_id, status, progress, stage }`.

### Digest configs

- `GET /digest-configs?include_inactive=1` — list.
- `POST /digest-configs` — body `{ name, icon?, color?, language?, summary_style?, digest_time?, max_articles?, digest_type?, trend_topic?, trend_keywords?, auto_generate? }`.
- `GET/PATCH/DELETE /digest-configs/:id` — DELETE soft (is_active=false).

### Markets + Competitors

- `GET /markets?include_inactive=1` — list.
- `POST /markets` — `{ name, description?, icon?, color?, language?, research_modules? }`.
- `GET /markets/:id` — detalhe + `competitors[]` + `sources[]` nested.
- `PATCH /markets/:id`, `DELETE /markets/:id` — DELETE soft.
- `GET /markets/:id/competitors`.
- `POST /markets/:id/competitors` — single (`{ name, website?, ... }`) ou batch (`{ competitors: [...] }`).
- `PATCH /markets/:id/competitors/:cid`, `DELETE /markets/:id/competitors/:cid`.
- `POST /markets/:id/competitors/:cid/briefing` — `{ profile_id? }`. Returns `{ job_id, status: 'queued' }`. Async via `after()`. **Custo IA real**.
- `GET /markets/:id/competitors/:cid/briefing` — histórico de briefings.

### Briefings (detail)

- `GET /briefings/:id` — detalhe completo do briefing (status, content jsonb, etc.).

### Briefing profiles

- `GET /briefing-profiles` — `{ data: { account: [...], builtins: [...] } }`.
- `POST /briefing-profiles` — cria perfil custom (não-builtin) na account.
- `PATCH/DELETE /briefing-profiles/:id` — preserva builtins (404 se tentar editar).

### Query (ad-hoc)

- `POST /query/briefing` — `{ profile_id, entity: { name, website?, cnpj?, aliases?, ticker? }, exclude_terms?, strict_match?, force_refresh? }`. **Sync, até 300s**. Retorna result inline e persiste em `query_runs`.
- `GET /query/runs?limit=30` — list do histórico.
- `GET /query/runs/:id` — detalhe com `result` jsonb completo.

### Gossip

- `GET /gossip/topics?include_inactive=1`.
- `POST /gossip/topics` — `{ name, type, aliases?, priority?, image_url? }` (type: `person` | `couple` | `event` | `show` | `brand`).
- `PATCH/DELETE /gossip/topics/:id`.
- `GET /gossip/sources`.
- `POST /gossip/sources` — `{ platform, handle, label, tier? }`.
- `DELETE /gossip/sources/:id` — soft.
- `GET /gossip/feed?topic_id&source_id&since&limit` — posts.
- `GET /gossip/dossiers?topic_id&limit` — dossiês AI.

### Social

- `GET /social/voices`, `POST /social/voices` (`{ platform, handle, label, category? }`), `DELETE /social/voices/:id`.
- `GET /social/crowd`, `POST /social/crowd` (`{ platform, identifier, label }`), `DELETE /social/crowd/:id`.
- `GET /social/feed?type=voices|crowd&since&limit`.

### Watchlist

- `GET /watchlist`, `POST /watchlist` (`{ kind, label, keywords?, metadata? }`).
- `PATCH/DELETE /watchlist/:id`.

### Brands (scrapes)

- `GET /brands` — list.
- `POST /brands` — `{ root_url, engine?: 'light' | 'deep', intent?, parceiro_id? }`. Light roda inline via `after()`; deep cria pending pra worker.
- `GET /brands/:id` — detalhe + `assets[]` nested.
- `DELETE /brands/:id` — hard delete.

## Trade-offs / TODOs

- **JWT secret**: middleware ainda usa service_role + filtro app-level. Quando
  `SUPABASE_JWT_SECRET` for setado, migrar pra JWT minting com claim
  `account_id` e RLS via `auth.jwt() ->> 'account_id'`. Policies já criadas.
- **Webhooks**: tabela `news_service_webhooks` existe mas dispatch não
  implementado. Front consome via polling.
- **Rate limit**: middleware sem rate limit ainda; só edge function
  `jsocial-news-proxy` tem in-memory 120/min por (user, account).
- **Crons → account_id propagado via `profiles.default_account_id`**: usuários
  sem `default_account_id` setado não veem dados gerados por cron. Solução
  futura: rodar cron por account ao invés de por user.

### Resolvidos
- ~~Briefings duplo-row~~ — `briefing.ts` aceita `existingBriefingId`.
- ~~Brand scrapes duplo-row~~ — `service.ts` aceita `existingScrapeId`.

## Procedimentos operacionais

### Rotacionar `JAY_NEWS_SOCIAL_SERVICE_KEY`

1. Gera nova key:
   ```bash
   NEW_KEY=$(openssl rand -hex 32)
   ```
2. Bcrypt local:
   ```bash
   node -e "console.log(require('bcryptjs').hashSync('$NEW_KEY', 10))"
   ```
3. Update no DB:
   ```sql
   update news_services set key_hash = '$2b$10$...' where slug = 'social';
   ```
4. Update Supabase secrets:
   ```bash
   cd jay-social
   SUPABASE_ACCESS_TOKEN=<token> npx supabase@latest secrets set \
     NEWS_SERVICE_KEY=$NEW_KEY --project-ref upespttemhmrewszxjet
   ```
5. Update `keys.md` (workspace) com novo plain.

### Smoke test

```bash
cd jay-news
BASE=https://jay-news.vercel.app \
SVCKEY=<plain> \
ACCOUNT_A=<arena uuid> \
ACCOUNT_B=<teste uuid> \
USER=<gabriel auth uuid> \
bash scripts/v1-smoke.sh
```

Espera-se 24 PASS / 0 FAIL.

### Adicionar novo service consumer

```sql
-- Insere row em news_services com bcrypt do plain key
insert into news_services (slug, name, key_hash, scopes, rate_limit_per_min)
values ('<slug>', '<Nome>', '$2b$10$...', array['*'], 600);
```

Salva o plain key no `keys.md` e configura como secret no consumidor.
