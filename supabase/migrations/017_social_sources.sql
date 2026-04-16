-- Phase 2: social sources — curated voices, crowd sources, cached posts

-- ─── social_voices ──────────────────────────────────────────────────────────
CREATE TABLE social_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'youtube', 'reddit_user')),
  handle TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'analyst' CHECK (category IN ('analyst', 'economist', 'trader', 'institution', 'other')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_voices_user ON social_voices(user_id) WHERE is_active = true;

ALTER TABLE social_voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own voices" ON social_voices
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own voices" ON social_voices
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own voices" ON social_voices
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users delete own voices" ON social_voices
  FOR DELETE USING (user_id = auth.uid());

-- ─── crowd_sources ──────────────────────────────────────────────────────────
CREATE TABLE crowd_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('reddit', 'stocktwits')),
  identifier TEXT NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crowd_user ON crowd_sources(user_id) WHERE is_active = true;

ALTER TABLE crowd_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own crowd" ON crowd_sources
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own crowd" ON crowd_sources
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own crowd" ON crowd_sources
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users delete own crowd" ON crowd_sources
  FOR DELETE USING (user_id = auth.uid());

-- ─── social_posts ───────────────────────────────────────────────────────────
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_id UUID REFERENCES social_voices(id) ON DELETE CASCADE,
  crowd_source_id UUID REFERENCES crowd_sources(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  author TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  source_url TEXT NOT NULL,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, external_id)
);

CREATE INDEX idx_social_posts_user_time ON social_posts(user_id, fetched_at DESC);
CREATE INDEX idx_social_posts_voice ON social_posts(voice_id, published_at DESC NULLS LAST) WHERE voice_id IS NOT NULL;
CREATE INDEX idx_social_posts_crowd ON social_posts(crowd_source_id, published_at DESC NULLS LAST) WHERE crowd_source_id IS NOT NULL;

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own social posts" ON social_posts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own social posts" ON social_posts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own social posts" ON social_posts
  FOR DELETE USING (user_id = auth.uid());
