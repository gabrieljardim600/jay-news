-- Social Brand Tracking — Instagram, Facebook Pages, Meta Ad Library
-- Lets users track competitor/brand handles, archive their posts/ads,
-- and get a daily briefing of what changed.

-- ===== Bucket: social-archive (mídias arquivadas) =====
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-archive',
  'social-archive',
  true,
  104857600, -- 100 MB
  ARRAY['image/png','image/jpeg','image/webp','image/gif','image/avif','video/mp4','video/webm']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "social_archive_read_public" ON storage.objects FOR SELECT
  USING (bucket_id = 'social-archive');

CREATE POLICY "social_archive_write_own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'social-archive' AND auth.uid() IS NOT NULL);

CREATE POLICY "social_archive_update_own" ON storage.objects FOR UPDATE
  USING (bucket_id = 'social-archive' AND auth.uid() IS NOT NULL);

CREATE POLICY "social_archive_delete_own" ON storage.objects FOR DELETE
  USING (bucket_id = 'social-archive' AND auth.uid() IS NOT NULL);


-- ===== social_brand_targets =====
-- Cada linha = uma marca/concorrente que o usuário quer monitorar em UMA plataforma.
-- Mesma marca em IG + FB Page + Ad Library = 3 linhas (linkadas opcionalmente por brand_key).
CREATE TABLE social_brand_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook_page', 'meta_ads', 'tiktok')),
  -- handle do IG, page id/slug do FB, page_id do Ad Library, @user do TikTok
  identifier TEXT NOT NULL,
  label TEXT NOT NULL,

  -- agrupador opcional: várias linhas com mesmo brand_key = mesma marca
  brand_key TEXT,
  -- nicho/categoria livre (ex: "trading br", "edtech", "fintech") — usado pra sugestão
  niche TEXT,

  -- modo de tracking
  mode TEXT NOT NULL DEFAULT 'archive_posts' CHECK (mode IN ('news_only', 'archive_posts')),

  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,

  -- meta enriquecida na primeira coleta (followers, name, profile pic)
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, platform, identifier)
);

CREATE INDEX idx_social_brand_targets_user ON social_brand_targets(user_id) WHERE is_active = true;
CREATE INDEX idx_social_brand_targets_brand_key ON social_brand_targets(user_id, brand_key) WHERE brand_key IS NOT NULL;
CREATE INDEX idx_social_brand_targets_sync ON social_brand_targets(last_synced_at NULLS FIRST) WHERE is_active = true;

ALTER TABLE social_brand_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_brand_targets_all_own" ON social_brand_targets FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION touch_social_brand_targets()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER social_brand_targets_touch
  BEFORE UPDATE ON social_brand_targets
  FOR EACH ROW EXECUTE FUNCTION touch_social_brand_targets();


-- ===== social_brand_posts =====
-- Cada linha = um post/reel/story/anúncio coletado. Inclui ads do Ad Library.
CREATE TABLE social_brand_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES social_brand_targets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  external_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('post', 'reel', 'video', 'story', 'ad')),
  platform TEXT NOT NULL,

  caption TEXT,
  permalink TEXT,
  posted_at TIMESTAMPTZ,

  -- mídia original (URLs do CDN, expiram)
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- caminhos arquivados em storage (quando mode=archive_posts)
  archive JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- métricas (likes, comments, views, reach, impressions, etc)
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- payload bruto da API (debug e re-processamento)
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- foi incluído no briefing diário?
  in_digest BOOLEAN NOT NULL DEFAULT false,

  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (target_id, external_id)
);

CREATE INDEX idx_social_brand_posts_target_time ON social_brand_posts(target_id, posted_at DESC NULLS LAST);
CREATE INDEX idx_social_brand_posts_user_time ON social_brand_posts(user_id, fetched_at DESC);
CREATE INDEX idx_social_brand_posts_undigested ON social_brand_posts(user_id, fetched_at DESC) WHERE in_digest = false;

ALTER TABLE social_brand_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_brand_posts_all_own" ON social_brand_posts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ===== social_brand_briefings =====
-- Briefing diário consolidado: o "digest" da área social/concorrência.
CREATE TABLE social_brand_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  date DATE NOT NULL,
  summary TEXT NOT NULL,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  posts_count INTEGER NOT NULL DEFAULT 0,
  ads_count INTEGER NOT NULL DEFAULT 0,
  targets_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, date)
);

CREATE INDEX idx_social_brand_briefings_user ON social_brand_briefings(user_id, date DESC);

ALTER TABLE social_brand_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_brand_briefings_all_own" ON social_brand_briefings FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
