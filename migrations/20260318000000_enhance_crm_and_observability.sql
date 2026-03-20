-- migrate:up

-- ═══════════════════════════════════════════════════════════════════════════
-- CRM Enhancement: Follow-up tracking, intro source, interaction logging
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE contacts ADD COLUMN follow_up_date DATE;
ALTER TABLE contacts ADD COLUMN intro_source TEXT;
ALTER TABLE contacts ADD COLUMN last_contacted_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN interaction_log JSONB DEFAULT '[]';
ALTER TABLE contacts ADD COLUMN got_response BOOLEAN DEFAULT NULL;

CREATE INDEX idx_contacts_follow_up ON contacts(follow_up_date) WHERE follow_up_date IS NOT NULL AND state IN ('contacted', 'replied');

COMMENT ON COLUMN contacts.follow_up_date IS 'When to next reach out (null = no follow-up scheduled)';
COMMENT ON COLUMN contacts.intro_source IS 'How you met this person: "warm intro via X", "cold LinkedIn DM", "YC founder list", etc.';
COMMENT ON COLUMN contacts.interaction_log IS 'Array of {timestamp, event, notes} objects tracking outreach history';
COMMENT ON COLUMN contacts.got_response IS 'NULL = not yet contacted, TRUE = they replied, FALSE = ghosted';

-- ═══════════════════════════════════════════════════════════════════════════
-- Job Feedback Tracking: Track LLM tailoring effectiveness
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE jobs ADD COLUMN got_callback BOOLEAN DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN callback_notes TEXT;
ALTER TABLE jobs ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX idx_jobs_updated_at ON jobs(updated_at DESC);

COMMENT ON COLUMN jobs.got_callback IS 'NULL = no response yet, TRUE = received callback/interview, FALSE = rejected';
COMMENT ON COLUMN jobs.callback_notes IS 'Notes on what resonated: "They mentioned my X project", "Asked about Y skill", etc.';
COMMENT ON COLUMN jobs.updated_at IS 'For optimistic locking: detect concurrent UI/n8n writes';

-- ═══════════════════════════════════════════════════════════════════════════
-- Optimistic Locking: Prevent race conditions between UI and n8n
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE contacts ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX idx_contacts_updated_at ON contacts(updated_at DESC);

-- Trigger to auto-update updated_at on modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_updated_at_trigger
BEFORE UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER contacts_updated_at_trigger
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════
-- Observability: Scraper run tracking for silent failure detection
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE scraper_runs (
  id SERIAL PRIMARY KEY,
  scraper_key TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  jobs_found INTEGER DEFAULT 0,
  errors TEXT[],
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  version TEXT
);

CREATE INDEX idx_scraper_runs_key_started ON scraper_runs(scraper_key, started_at DESC);
CREATE INDEX idx_scraper_runs_status ON scraper_runs(status) WHERE status IN ('running', 'failed');

COMMENT ON TABLE scraper_runs IS 'Log table for scraper execution: detect silent failures via 0 jobs_found on normally-productive scrapers';
COMMENT ON COLUMN scraper_runs.version IS 'Git commit hash or package version for debugging regressions';

-- View: Latest scraper run per key
CREATE VIEW latest_scraper_runs AS
SELECT DISTINCT ON (scraper_key)
  scraper_key,
  started_at,
  completed_at,
  jobs_found,
  errors,
  status
FROM scraper_runs
ORDER BY scraper_key, started_at DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- Manual Job Source: Allow CSV import and manual entry
-- ═══════════════════════════════════════════════════════════════════════════

-- Add 'manual' to job source enum (if using enum type)
-- ALTER TYPE job_source ADD VALUE IF NOT EXISTS 'manual';

-- If source is TEXT (more likely given flexible architecture):
-- No schema change needed, just document valid values

COMMENT ON COLUMN jobs.source IS 'Valid sources: jobspy-*, ats-*, github-simplify, wellfound, manual';

-- migrate:down

DROP VIEW IF EXISTS latest_scraper_runs;
DROP TABLE IF EXISTS scraper_runs;

DROP TRIGGER IF EXISTS contacts_updated_at_trigger ON contacts;
DROP TRIGGER IF EXISTS jobs_updated_at_trigger ON jobs;
DROP FUNCTION IF EXISTS update_updated_at_column();

ALTER TABLE contacts DROP COLUMN IF EXISTS updated_at;
ALTER TABLE contacts DROP COLUMN IF EXISTS got_response;
ALTER TABLE contacts DROP COLUMN IF EXISTS interaction_log;
ALTER TABLE contacts DROP COLUMN IF EXISTS last_contacted_at;
ALTER TABLE contacts DROP COLUMN IF EXISTS intro_source;
ALTER TABLE contacts DROP COLUMN IF EXISTS follow_up_date;

ALTER TABLE jobs DROP COLUMN IF EXISTS updated_at;
ALTER TABLE jobs DROP COLUMN IF EXISTS callback_notes;
ALTER TABLE jobs DROP COLUMN IF EXISTS got_callback;
