-- Which research modules are active per market. Defaults to ['core'].
-- Each module is a pack of providers (APIs/scrapers) that runs together
-- during briefing generation. See lib/markets/research/modules for
-- canonical ids.

ALTER TABLE markets
  ADD COLUMN research_modules TEXT[] NOT NULL DEFAULT ARRAY['core'];
