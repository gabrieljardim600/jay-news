-- Phase 0 of news-api/v1 multi-account: add account_id (nullable) to digests
-- and digest_configs. Application-level filter is the primary barrier (v1
-- routes go through service_role); RLS policies below provide defense-in-depth
-- for any future authenticated client that bypasses the helper.

alter table digest_configs add column if not exists account_id uuid;
alter table digests        add column if not exists account_id uuid;

create index if not exists digest_configs_account_id_idx
  on digest_configs (account_id) where account_id is not null;
create index if not exists digests_account_id_idx
  on digests (account_id) where account_id is not null;

-- New policies coexist with whatever user_id-based policies already exist.
-- They become active when a request carries auth.jwt() with an account_id
-- claim (defense-in-depth path); v1 routes use service_role and bypass RLS.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'digest_configs' and policyname = 'v1_digest_configs_by_account'
  ) then
    create policy "v1_digest_configs_by_account" on digest_configs
      for all
      using (
        account_id is not null
        and account_id = ((auth.jwt() ->> 'account_id'))::uuid
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'digests' and policyname = 'v1_digests_by_account'
  ) then
    create policy "v1_digests_by_account" on digests
      for all
      using (
        account_id is not null
        and account_id = ((auth.jwt() ->> 'account_id'))::uuid
      );
  end if;
end$$;
