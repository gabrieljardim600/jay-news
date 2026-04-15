-- Articles collected per market.
-- Same article URL gets one row per market; `mentioned_competitor_ids`
-- captures which competitors it cites, `found_via` notes how it entered.

CREATE TABLE market_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  summary TEXT,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  relevance_score FLOAT NOT NULL DEFAULT 0,
  mentioned_competitor_ids UUID[] NOT NULL DEFAULT '{}',
  found_via TEXT NOT NULL DEFAULT 'general' CHECK (found_via IN ('general', 'competitor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (market_id, source_url)
);
CREATE INDEX idx_market_articles_market ON market_articles(market_id, detected_at DESC);
CREATE INDEX idx_market_articles_mentions ON market_articles USING GIN (mentioned_competitor_ids);

CREATE TABLE market_collection_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  articles_found INTEGER NOT NULL DEFAULT 0,
  articles_new INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX idx_market_runs_market ON market_collection_runs(market_id, started_at DESC);

-- RLS
ALTER TABLE market_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_articles_all_own" ON market_articles FOR ALL
  USING (market_id IN (SELECT id FROM markets WHERE user_id = auth.uid()))
  WITH CHECK (market_id IN (SELECT id FROM markets WHERE user_id = auth.uid()));

ALTER TABLE market_collection_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_runs_select_own" ON market_collection_runs FOR SELECT
  USING (market_id IN (SELECT id FROM markets WHERE user_id = auth.uid()));
