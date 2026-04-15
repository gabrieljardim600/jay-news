-- Cache global de payloads de providers de pesquisa.
-- Chaveado por (provider_id, entity_key) — onde entity_key é CNPJ normalizado
-- quando disponível, senão "nome|host". NÃO é por usuário — briefings de
-- qualquer user reaproveitam o mesmo cache. Payloads contêm só dados
-- públicos da empresa.

CREATE TABLE research_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  payload JSONB,
  hints JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (provider_id, entity_key)
);

CREATE INDEX idx_research_cache_expires ON research_cache(expires_at);
CREATE INDEX idx_research_cache_lookup ON research_cache(provider_id, entity_key);

-- Sem RLS: acesso apenas via service role no server.
ALTER TABLE research_cache ENABLE ROW LEVEL SECURITY;
