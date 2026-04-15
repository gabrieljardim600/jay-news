-- Briefings gerados por concorrente, com snapshot estruturado + resumo.

CREATE TABLE competitor_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES market_competitors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  content JSONB,
  resumo TEXT,
  data_quality INTEGER,
  model_used TEXT,
  articles_analyzed INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_competitor_briefings_competitor ON competitor_briefings(competitor_id, created_at DESC);
CREATE INDEX idx_competitor_briefings_market ON competitor_briefings(market_id, created_at DESC);

ALTER TABLE competitor_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competitor_briefings_all_own" ON competitor_briefings FOR ALL
  USING (market_id IN (SELECT id FROM markets WHERE user_id = auth.uid()))
  WITH CHECK (market_id IN (SELECT id FROM markets WHERE user_id = auth.uid()));
