-- User settings
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_time TIME NOT NULL DEFAULT '07:00',
  language TEXT NOT NULL DEFAULT 'pt-BR',
  summary_style TEXT NOT NULL DEFAULT 'executive',
  max_articles INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Topics
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RSS sources
CREATE TABLE rss_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  query TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exclusions
CREATE TABLE exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Digests
CREATE TABLE digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'
);

-- Articles
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_id UUID NOT NULL REFERENCES digests(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  summary TEXT NOT NULL,
  relevance_score FLOAT NOT NULL,
  is_highlight BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_articles_digest_id ON articles(digest_id);
CREATE INDEX idx_articles_relevance ON articles(relevance_score DESC);
CREATE INDEX idx_digests_user_date ON digests(user_id, generated_at DESC);
CREATE INDEX idx_topics_user ON topics(user_id);

-- RLS: Enable on all tables
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- RLS Policies: user_settings
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies: topics
CREATE POLICY "Users can view own topics" ON topics
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own topics" ON topics
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own topics" ON topics
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own topics" ON topics
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies: rss_sources
CREATE POLICY "Users can view own sources" ON rss_sources
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own sources" ON rss_sources
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own sources" ON rss_sources
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own sources" ON rss_sources
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies: alerts
CREATE POLICY "Users can view own alerts" ON alerts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own alerts" ON alerts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own alerts" ON alerts
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own alerts" ON alerts
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies: exclusions
CREATE POLICY "Users can view own exclusions" ON exclusions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own exclusions" ON exclusions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own exclusions" ON exclusions
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own exclusions" ON exclusions
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies: digests
CREATE POLICY "Users can view own digests" ON digests
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own digests" ON digests
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own digests" ON digests
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies: articles (access via digest ownership)
CREATE POLICY "Users can view own articles" ON articles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM digests WHERE digests.id = articles.digest_id AND digests.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own articles" ON articles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM digests WHERE digests.id = articles.digest_id AND digests.user_id = auth.uid())
  );

-- Auto-create user_settings on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
