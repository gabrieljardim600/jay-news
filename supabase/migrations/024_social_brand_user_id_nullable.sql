-- 024 — user_id nas 3 tabelas social_brand_* passa a ser nullable.
-- v1 M2M routes scopam por account_id; user_id vira audit-only.
alter table social_brand_targets    alter column user_id drop not null;
alter table social_brand_posts      alter column user_id drop not null;
alter table social_brand_briefings  alter column user_id drop not null;
