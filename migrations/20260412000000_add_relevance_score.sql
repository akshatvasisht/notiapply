ALTER TABLE jobs ADD COLUMN relevance_score SMALLINT;
ALTER TABLE jobs ADD COLUMN score_breakdown JSONB;
