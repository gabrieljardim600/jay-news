-- Add source_type to rss_sources: 'rss' (default) or 'web' (domain-based Tavily search)
ALTER TABLE rss_sources ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'rss';

-- Add check constraint for valid source types
ALTER TABLE rss_sources ADD CONSTRAINT rss_sources_type_check CHECK (source_type IN ('rss', 'web'));
