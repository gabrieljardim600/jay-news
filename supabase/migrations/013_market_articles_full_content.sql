-- Store cleaned full-text body for market articles so the UI pode
-- mostrar a matéria tratada sem redirecionar para o link original.

ALTER TABLE market_articles
  ADD COLUMN IF NOT EXISTS full_content TEXT;
