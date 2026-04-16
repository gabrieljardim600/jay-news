CREATE TABLE IF NOT EXISTS trading_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edition TEXT NOT NULL CHECK (edition IN ('morning', 'closing')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  global_bullets JSONB DEFAULT '[]',
  brasil_bullets JSONB DEFAULT '[]',
  agenda JSONB DEFAULT '[]',
  sentiment JSONB DEFAULT '{}',
  take TEXT,
  happened_bullets JSONB,
  agenda_review TEXT,
  overnight TEXT,
  closing_take TEXT,
  model_used TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, edition, date)
);
CREATE INDEX IF NOT EXISTS trading_briefs_user_date ON trading_briefs(user_id, date DESC, edition);
ALTER TABLE trading_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trading_briefs_own" ON trading_briefs FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
