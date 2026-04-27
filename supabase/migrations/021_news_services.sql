-- News Services API (M2M) — multi-service consumption of jay-news data
-- See: jay-social/docs/news-integration-plan.md

create extension if not exists pgcrypto;

-- Service consumers (one row per product: 'social', futuros)
create table if not exists news_services (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  key_hash            text not null,
  scopes              text[] not null default '{}',
  rate_limit_per_min  int not null default 600,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

-- Mapping/audit only — RLS uses account_id GUC, not shadow user
create table if not exists news_service_accounts (
  service_slug         text not null references news_services(slug) on delete cascade,
  external_account_id  uuid not null,
  display_name         text,
  created_at           timestamptz not null default now(),
  primary key (service_slug, external_account_id)
);

create table if not exists news_service_webhooks (
  id            uuid primary key default gen_random_uuid(),
  service_slug  text not null references news_services(slug) on delete cascade,
  event         text not null,
  url           text not null,
  secret        text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists news_service_webhooks_service_event_idx
  on news_service_webhooks (service_slug, event)
  where active = true;

alter table news_services enable row level security;
alter table news_service_accounts enable row level security;
alter table news_service_webhooks enable row level security;
-- No public policies — touched only via service_role from /api/v1/* middleware.

-- Seed: 'social' service consumer (jay-social).
-- bcrypt hash do plain key em workspace keys.md ("JAY_NEWS_SOCIAL_SERVICE_KEY")
insert into news_services (slug, name, key_hash, scopes, rate_limit_per_min)
values (
  'social',
  'Jay Social',
  '$2b$10$UYpJPdUImBvnJddM.3cEEubipIgDQHaX.Lu1KcdAoopuLb8EVTvvW',
  array['*'],
  600
)
on conflict (slug) do nothing;

