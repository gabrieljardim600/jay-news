-- 023_social_brand_account_id.sql
-- Adiciona account_id (nullable) nas 3 tabelas de Brand Tracking pra permitir
-- escopo por conta no v1 M2M API (consumido pelo jay-social via proxy).
-- Backfill a partir de profiles.default_account_id / account_members
-- (essas tabelas vivem no mesmo Supabase, namespace do jay-social).

alter table social_brand_targets    add column if not exists account_id uuid;
alter table social_brand_posts      add column if not exists account_id uuid;
alter table social_brand_briefings  add column if not exists account_id uuid;

create index if not exists idx_sb_targets_account
  on social_brand_targets(account_id) where account_id is not null;
create index if not exists idx_sb_posts_account
  on social_brand_posts(account_id) where account_id is not null;
create index if not exists idx_sb_briefings_account
  on social_brand_briefings(account_id) where account_id is not null;

-- Backfill (defensivo: só preenche quando ainda nulo)
update social_brand_targets t set account_id = coalesce(
  (select default_account_id from profiles where user_id = t.user_id),
  (select account_id from account_members where user_id = t.user_id order by joined_at asc limit 1)
)
where account_id is null;

update social_brand_posts p set account_id = (
  select account_id from social_brand_targets where id = p.target_id
)
where account_id is null;

update social_brand_briefings b set account_id = coalesce(
  (select default_account_id from profiles where user_id = b.user_id),
  (select account_id from account_members where user_id = b.user_id order by joined_at asc limit 1)
)
where account_id is null;

-- Constraints account-scoped (UPSERT onConflict no v1).
-- Convivem com os UNIQUE existentes (user_id, ...) — não removemos pra não
-- quebrar /api/social-brand/* legado (cookie-auth, escopo por user_id).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ux_sb_targets_account_platform_identifier'
  ) then
    alter table social_brand_targets
      add constraint ux_sb_targets_account_platform_identifier
      unique (account_id, platform, identifier);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'ux_sb_briefings_account_date'
  ) then
    alter table social_brand_briefings
      add constraint ux_sb_briefings_account_date
      unique (account_id, date);
  end if;
end $$;

-- Defense-in-depth RLS via JWT account_id (mesma estratégia da migration 022).
-- v1 routes usam service_role e bypassam RLS; isso protege qualquer client
-- autenticado que tente bater direto.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'social_brand_targets' and policyname = 'v1_sb_targets_by_account'
  ) then
    create policy "v1_sb_targets_by_account" on social_brand_targets
      for all
      using (
        account_id is not null
        and account_id = ((auth.jwt() ->> 'account_id'))::uuid
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'social_brand_posts' and policyname = 'v1_sb_posts_by_account'
  ) then
    create policy "v1_sb_posts_by_account" on social_brand_posts
      for all
      using (
        account_id is not null
        and account_id = ((auth.jwt() ->> 'account_id'))::uuid
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'social_brand_briefings' and policyname = 'v1_sb_briefings_by_account'
  ) then
    create policy "v1_sb_briefings_by_account" on social_brand_briefings
      for all
      using (
        account_id is not null
        and account_id = ((auth.jwt() ->> 'account_id'))::uuid
      );
  end if;
end$$;
