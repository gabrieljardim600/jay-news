-- 1. Create digest_configs table
CREATE TABLE digest_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📰',
  color TEXT DEFAULT '#fb830e',
  language TEXT NOT NULL DEFAULT 'pt-BR',
  summary_style TEXT NOT NULL DEFAULT 'executive' CHECK (summary_style IN ('executive', 'detailed')),
  digest_time TIME NOT NULL DEFAULT '07:00',
  max_articles INTEGER NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_digest_configs_user ON digest_configs(user_id);

-- 2. Add digest_config_id to existing tables
ALTER TABLE topics ADD COLUMN digest_config_id UUID REFERENCES digest_configs(id) ON DELETE CASCADE;
ALTER TABLE rss_sources ADD COLUMN digest_config_id UUID REFERENCES digest_configs(id) ON DELETE CASCADE;
ALTER TABLE rss_sources ADD COLUMN weight INTEGER NOT NULL DEFAULT 3 CHECK (weight >= 1 AND weight <= 5);
ALTER TABLE alerts ADD COLUMN digest_config_id UUID REFERENCES digest_configs(id) ON DELETE CASCADE;
ALTER TABLE exclusions ADD COLUMN digest_config_id UUID REFERENCES digest_configs(id) ON DELETE CASCADE;
ALTER TABLE digests ADD COLUMN digest_config_id UUID REFERENCES digest_configs(id) ON DELETE SET NULL;

-- 3. Indexes
CREATE INDEX idx_topics_config ON topics(digest_config_id);
CREATE INDEX idx_rss_sources_config ON rss_sources(digest_config_id);
CREATE INDEX idx_alerts_config ON alerts(digest_config_id);
CREATE INDEX idx_exclusions_config ON exclusions(digest_config_id);
CREATE INDEX idx_digests_config ON digests(digest_config_id);

-- 4. Data migration: ensure all users with data have user_settings
INSERT INTO user_settings (user_id)
SELECT DISTINCT user_id FROM (
  SELECT user_id FROM topics
  UNION SELECT user_id FROM rss_sources
  UNION SELECT user_id FROM alerts
  UNION SELECT user_id FROM exclusions
  UNION SELECT user_id FROM digests
) all_users
WHERE user_id NOT IN (SELECT user_id FROM user_settings)
ON CONFLICT DO NOTHING;

-- 5. Create default digest_config per user
INSERT INTO digest_configs (user_id, name, icon, language, summary_style, digest_time, max_articles)
SELECT user_id, 'Meu Digest', '📰', language, summary_style, digest_time, max_articles
FROM user_settings;

-- 6. Link existing records
UPDATE topics SET digest_config_id = (
  SELECT id FROM digest_configs WHERE digest_configs.user_id = topics.user_id ORDER BY created_at ASC LIMIT 1
);
UPDATE rss_sources SET digest_config_id = (
  SELECT id FROM digest_configs WHERE digest_configs.user_id = rss_sources.user_id ORDER BY created_at ASC LIMIT 1
);
UPDATE alerts SET digest_config_id = (
  SELECT id FROM digest_configs WHERE digest_configs.user_id = alerts.user_id ORDER BY created_at ASC LIMIT 1
);
UPDATE exclusions SET digest_config_id = (
  SELECT id FROM digest_configs WHERE digest_configs.user_id = exclusions.user_id ORDER BY created_at ASC LIMIT 1
);
UPDATE digests SET digest_config_id = (
  SELECT id FROM digest_configs WHERE digest_configs.user_id = digests.user_id ORDER BY created_at ASC LIMIT 1
);

-- 7. Make digest_config_id NOT NULL on config tables (digests stays nullable to preserve history)
ALTER TABLE topics ALTER COLUMN digest_config_id SET NOT NULL;
ALTER TABLE rss_sources ALTER COLUMN digest_config_id SET NOT NULL;
ALTER TABLE alerts ALTER COLUMN digest_config_id SET NOT NULL;
ALTER TABLE exclusions ALTER COLUMN digest_config_id SET NOT NULL;

-- 8. RLS for digest_configs
ALTER TABLE digest_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own configs" ON digest_configs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own configs" ON digest_configs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own configs" ON digest_configs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own configs" ON digest_configs FOR DELETE USING (user_id = auth.uid());
