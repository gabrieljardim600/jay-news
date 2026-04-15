-- Perfis de briefing: bundles de módulos de research + prompt de síntese
-- focados em uma ótica (produto, financeiro, tech, reputação, liderança).

CREATE TABLE briefing_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,                       -- identificador estável (pgm / fin / tech / cx / leader)
  label TEXT NOT NULL,
  description TEXT,
  icon TEXT,                                -- nome de ícone lucide
  module_ids TEXT[] NOT NULL DEFAULT '{}',  -- ids dos research modules
  synth_prompt TEXT NOT NULL,               -- instrução pro Claude
  output_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX briefing_profiles_user_slug_uq ON briefing_profiles(user_id, slug);
CREATE INDEX briefing_profiles_user_idx ON briefing_profiles(user_id, sort_order);

ALTER TABLE briefing_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "briefing_profiles_all_own" ON briefing_profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger pra manter updated_at
CREATE OR REPLACE FUNCTION touch_briefing_profiles()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER briefing_profiles_touch
  BEFORE UPDATE ON briefing_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_briefing_profiles();

-- Briefings agora podem referenciar o perfil usado
ALTER TABLE competitor_briefings
  ADD COLUMN IF NOT EXISTS profile_slug TEXT,
  ADD COLUMN IF NOT EXISTS profile_label TEXT;

CREATE INDEX IF NOT EXISTS idx_competitor_briefings_profile ON competitor_briefings(profile_slug);
