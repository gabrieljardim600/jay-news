-- Markets: vertical tracking of a market with subtopics, competitors and optional sources.

CREATE TABLE markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📊',
  color TEXT DEFAULT '#fb830e',
  language TEXT NOT NULL DEFAULT 'pt-BR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_markets_user ON markets(user_id);

CREATE TABLE market_subtopics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_market_subtopics_market ON market_subtopics(market_id);

CREATE TABLE market_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  logo_url TEXT,
  ai_suggested BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_market_competitors_market ON market_competitors(market_id);

CREATE TABLE market_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'rss' CHECK (source_type IN ('rss', 'web')),
  weight INTEGER NOT NULL DEFAULT 3 CHECK (weight >= 1 AND weight <= 5),
  ai_suggested BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_market_sources_market ON market_sources(market_id);

-- RLS
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "markets_select_own" ON markets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "markets_insert_own" ON markets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "markets_update_own" ON markets FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "markets_delete_own" ON markets FOR DELETE USING (user_id = auth.uid());

ALTER TABLE market_subtopics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_subtopics_all_own" ON market_subtopics FOR ALL
  USING (market_id IN (SELECT id FROM markets WHERE user_id = auth.uid()))
  WITH CHECK (market_id IN (SELECT id FROM markets WHERE user_id = auth.uid()));

ALTER TABLE market_competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_competitors_all_own" ON market_competitors FOR ALL
  USING (market_id IN (SELECT id FROM markets WHERE user_id = auth.uid()))
  WITH CHECK (market_id IN (SELECT id FROM markets WHERE user_id = auth.uid()));

ALTER TABLE market_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_sources_all_own" ON market_sources FOR ALL
  USING (market_id IN (SELECT id FROM markets WHERE user_id = auth.uid()))
  WITH CHECK (market_id IN (SELECT id FROM markets WHERE user_id = auth.uid()));
