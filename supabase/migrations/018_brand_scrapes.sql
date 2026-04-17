-- Brand asset scraping: URL → logos, cores, ícones, imagens, fontes, screenshots + design system curado por AI.
-- Funcionalidade nova do Jay News: usuário aponta um site, sistema extrai e organiza o branding.

-- ===== Bucket Storage =====

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  52428800,  -- 50 MB
  ARRAY['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','image/x-icon','image/avif','font/woff','font/woff2','font/ttf','font/otf','application/font-woff','application/font-woff2','text/html','application/json']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "brand_assets_read_public" ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-assets');

CREATE POLICY "brand_assets_write_own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'brand-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "brand_assets_update_own" ON storage.objects FOR UPDATE
  USING (bucket_id = 'brand-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "brand_assets_delete_own" ON storage.objects FOR DELETE
  USING (bucket_id = 'brand-assets' AND auth.uid() IS NOT NULL);


-- ===== Tabela brand_scrapes =====

CREATE TABLE brand_scrapes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Input
  root_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  urls_to_scrape TEXT[] NOT NULL DEFAULT '{}',

  -- Execution
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'crawling', 'scraping', 'enriching', 'completed', 'failed')),
  engine TEXT NOT NULL DEFAULT 'light' CHECK (engine IN ('light', 'deep')),
  error TEXT,

  -- Output metadata
  title TEXT,
  description TEXT,
  favicon_url TEXT,
  urls_scraped TEXT[] NOT NULL DEFAULT '{}',
  total_assets INTEGER NOT NULL DEFAULT 0,
  total_colors INTEGER NOT NULL DEFAULT 0,

  -- AI-curated output
  design_system JSONB,
  html_preview_path TEXT,

  -- Linkage (opcional) — FK sem REFERENCES porque crm_parceiros mora em outro projeto (jay-partner)
  parceiro_id UUID,
  intent TEXT CHECK (intent IN ('whitelabel', 'inspiration', 'competitor')),

  -- Timestamps
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_brand_scrapes_user ON brand_scrapes(user_id, created_at DESC);
CREATE INDEX idx_brand_scrapes_domain ON brand_scrapes(domain);
CREATE INDEX idx_brand_scrapes_parceiro ON brand_scrapes(parceiro_id) WHERE parceiro_id IS NOT NULL;
CREATE INDEX idx_brand_scrapes_status ON brand_scrapes(status)
  WHERE status IN ('pending', 'crawling', 'scraping', 'enriching');

ALTER TABLE brand_scrapes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_scrapes_all_own" ON brand_scrapes FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION touch_brand_scrapes()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brand_scrapes_touch
  BEFORE UPDATE ON brand_scrapes
  FOR EACH ROW EXECUTE FUNCTION touch_brand_scrapes();


-- ===== Tabela brand_assets =====

CREATE TABLE brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scrape_id UUID NOT NULL REFERENCES brand_scrapes(id) ON DELETE CASCADE,

  -- Classification
  type TEXT NOT NULL CHECK (type IN ('logo', 'icon', 'image', 'font', 'screenshot')),
  role TEXT,

  -- Source
  original_url TEXT,
  source_page_url TEXT,

  -- Storage
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  file_size_kb INTEGER,
  mime_type TEXT,

  -- Metadata
  width INTEGER,
  height INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_brand_assets_scrape ON brand_assets(scrape_id, type);
CREATE INDEX idx_brand_assets_role ON brand_assets(role) WHERE role IS NOT NULL;

ALTER TABLE brand_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_assets_via_scrape" ON brand_assets FOR ALL
  USING (scrape_id IN (SELECT id FROM brand_scrapes WHERE user_id = auth.uid()))
  WITH CHECK (scrape_id IN (SELECT id FROM brand_scrapes WHERE user_id = auth.uid()));
