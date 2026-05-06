-- 025_profile_id_radar.sql
--
-- Phase 12 do Radar (jay-social) — adiciona profile_id (nullable) nas
-- tabelas account-scoped do jay-news pra permitir scope por perfil de
-- monitoramento. A tabela canonica radar_profiles vive no jay-social
-- (mesma Supabase). Filtragem nos endpoints v1 fica opcional: sem param,
-- retorna account-wide (backwards-compat); com profile_id, filtra.
--
-- Backfill: pra cada linha com account_id setado, herda profile_id do
-- perfil is_default=true daquela account (criado pela migration de
-- backfill 20260506_03 do jay-social).

alter table digests                add column if not exists profile_id uuid;
alter table digest_configs         add column if not exists profile_id uuid;
alter table social_brand_targets   add column if not exists profile_id uuid;
alter table social_brand_posts     add column if not exists profile_id uuid;
alter table social_brand_briefings add column if not exists profile_id uuid;
alter table social_voices          add column if not exists profile_id uuid;
alter table crowd_sources          add column if not exists profile_id uuid;
alter table rss_sources            add column if not exists profile_id uuid;

-- Índices compostos pra (account_id, profile_id) — queries comuns filtram por ambos.
create index if not exists digests_account_profile_idx
  on digests (account_id, profile_id) where account_id is not null;
create index if not exists digest_configs_account_profile_idx
  on digest_configs (account_id, profile_id) where account_id is not null;
create index if not exists sb_targets_account_profile_idx
  on social_brand_targets (account_id, profile_id) where account_id is not null;
create index if not exists sb_posts_account_profile_idx
  on social_brand_posts (account_id, profile_id) where account_id is not null;
create index if not exists sb_briefings_account_profile_idx
  on social_brand_briefings (account_id, profile_id) where account_id is not null;
create index if not exists social_voices_account_profile_idx
  on social_voices (account_id, profile_id) where account_id is not null;
create index if not exists crowd_sources_account_profile_idx
  on crowd_sources (account_id, profile_id) where account_id is not null;
create index if not exists rss_sources_account_profile_idx
  on rss_sources (account_id, profile_id) where account_id is not null;

-- Backfill: cada linha herda o perfil default (Geral) da sua account.
update digests t set profile_id = (
  select id from radar_profiles
  where account_id = t.account_id and is_default
)
where account_id is not null and profile_id is null;

update digest_configs t set profile_id = (
  select id from radar_profiles
  where account_id = t.account_id and is_default
)
where account_id is not null and profile_id is null;

update social_brand_targets t set profile_id = (
  select id from radar_profiles
  where account_id = t.account_id and is_default
)
where account_id is not null and profile_id is null;

update social_brand_posts t set profile_id = (
  select id from radar_profiles
  where account_id = t.account_id and is_default
)
where account_id is not null and profile_id is null;

update social_brand_briefings t set profile_id = (
  select id from radar_profiles
  where account_id = t.account_id and is_default
)
where account_id is not null and profile_id is null;

update social_voices t set profile_id = (
  select id from radar_profiles
  where account_id = t.account_id and is_default
)
where account_id is not null and profile_id is null;

update crowd_sources t set profile_id = (
  select id from radar_profiles
  where account_id = t.account_id and is_default
)
where account_id is not null and profile_id is null;

update rss_sources t set profile_id = (
  select id from radar_profiles
  where account_id = t.account_id and is_default
)
where account_id is not null and profile_id is null;
