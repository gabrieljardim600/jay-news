-- Add full_content to fetched_articles: stores the complete original text
ALTER TABLE fetched_articles ADD COLUMN IF NOT EXISTS full_content TEXT;

-- Add full_content to articles: persists original content alongside AI summary
ALTER TABLE articles ADD COLUMN IF NOT EXISTS full_content TEXT;
