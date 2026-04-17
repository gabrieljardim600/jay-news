-- Gossip tab: feeds de fofoca + topics editoriais tagueáveis + dossiê diário
-- Namespace próprio gossip_*; fetchers reutilizam src/lib/social

-- ===== Fontes =====
CREATE TABLE IF NOT EXISTS gossip_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  platform TEXT NOT NULL CHECK (platform IN ('rss', 'twitter', 'youtube', 'reddit')),
  handle TEXT NOT NULL,
  label TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'primary'
    CHECK (tier IN ('primary', 'proxy', 'aggregator')),
  active BOOLEAN NOT NULL DEFAULT true,

  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, platform, handle)
);
CREATE INDEX IF NOT EXISTS idx_gossip_sources_user_active ON gossip_sources(user_id, active);

-- ===== Posts =====
CREATE TABLE IF NOT EXISTS gossip_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES gossip_sources(id) ON DELETE CASCADE,

  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_gossip_posts_user_published ON gossip_posts(user_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_gossip_posts_source ON gossip_posts(source_id, published_at DESC);

-- ===== Topics (entidades editoriais) =====
CREATE TABLE IF NOT EXISTS gossip_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN ('person', 'couple', 'event', 'show', 'brand')),
  name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  priority SMALLINT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_gossip_topics_user_active ON gossip_topics(user_id, active);

-- ===== Post ↔ Topic (N:N) =====
CREATE TABLE IF NOT EXISTS gossip_post_topics (
  post_id UUID NOT NULL REFERENCES gossip_posts(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES gossip_topics(id) ON DELETE CASCADE,

  confidence REAL NOT NULL DEFAULT 1.0,
  matched_by TEXT NOT NULL CHECK (matched_by IN ('alias', 'claude', 'manual', 'manual_negative')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (post_id, topic_id)
);
CREATE INDEX IF NOT EXISTS idx_gossip_post_topics_topic ON gossip_post_topics(topic_id, created_at DESC);

-- ===== Dossiês =====
CREATE TABLE IF NOT EXISTS gossip_dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES gossip_topics(id) ON DELETE CASCADE,

  date DATE NOT NULL,
  summary TEXT NOT NULL,
  key_quotes JSONB NOT NULL DEFAULT '[]'::jsonb,
  spike_score REAL NOT NULL DEFAULT 0,
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
CREATE INDEX IF NOT EXISTS idx_gossip_dossiers_user_date ON gossip_dossiers(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_gossip_dossiers_topic_date ON gossip_dossiers(topic_id, date DESC);

-- ===== RLS =====
ALTER TABLE gossip_sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gossip_posts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE gossip_topics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE gossip_post_topics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gossip_dossiers     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gossip_sources_all_own" ON gossip_sources;
CREATE POLICY "gossip_sources_all_own" ON gossip_sources FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "gossip_posts_all_own" ON gossip_posts;
CREATE POLICY "gossip_posts_all_own" ON gossip_posts FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "gossip_topics_all_own" ON gossip_topics;
CREATE POLICY "gossip_topics_all_own" ON gossip_topics FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "gossip_dossiers_all_own" ON gossip_dossiers;
CREATE POLICY "gossip_dossiers_all_own" ON gossip_dossiers FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "gossip_post_topics_via_post" ON gossip_post_topics;
CREATE POLICY "gossip_post_topics_via_post" ON gossip_post_topics FOR ALL
  USING (post_id IN (SELECT id FROM gossip_posts WHERE user_id = auth.uid()))
  WITH CHECK (post_id IN (SELECT id FROM gossip_posts WHERE user_id = auth.uid()));

-- ===== Triggers touch =====
CREATE OR REPLACE FUNCTION touch_gossip() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gossip_sources_touch ON gossip_sources;
CREATE TRIGGER gossip_sources_touch BEFORE UPDATE ON gossip_sources
  FOR EACH ROW EXECUTE FUNCTION touch_gossip();

DROP TRIGGER IF EXISTS gossip_topics_touch ON gossip_topics;
CREATE TRIGGER gossip_topics_touch BEFORE UPDATE ON gossip_topics
  FOR EACH ROW EXECUTE FUNCTION touch_gossip();
