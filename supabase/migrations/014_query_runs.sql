-- Histórico de consultas da aba Consulta (raw e briefing com perfil).
-- Permite reabrir um resultado antigo sem refazer a pesquisa.

CREATE TABLE IF NOT EXISTS query_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('raw', 'briefing')),
  entity_name TEXT NOT NULL,
  entity JSONB NOT NULL DEFAULT '{}'::jsonb,
  profile_id UUID,
  profile_slug TEXT,
  profile_label TEXT,
  module_ids TEXT[] NOT NULL DEFAULT '{}',
  result JSONB NOT NULL,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS query_runs_user_created_idx ON query_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS query_runs_user_name_idx ON query_runs(user_id, entity_name);

ALTER TABLE query_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "query_runs_all_own" ON query_runs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
