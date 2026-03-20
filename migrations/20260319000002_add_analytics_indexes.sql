-- Add performance indexes for analytics queries
-- These indexes speed up the analytics dashboard and monitoring pages

-- Index for callback analytics query (getCallbackAnalytics)
-- Speeds up queries filtering by state and got_callback
CREATE INDEX IF NOT EXISTS idx_jobs_callback_analytics
ON jobs(state, got_callback)
WHERE state IN ('submitted', 'tracking');

-- Index for contact enrichment queries
-- Speeds up finding contacts that need company data enrichment
CREATE INDEX IF NOT EXISTS idx_contacts_enrichment
ON contacts(company_name)
WHERE company_industry IS NULL;

-- Index for scraper monitoring queries
-- Speeds up finding failed or running scrapers
CREATE INDEX IF NOT EXISTS idx_scraper_runs_status
ON scraper_runs(status, started_at DESC)
WHERE status IN ('running', 'failed');

COMMENT ON INDEX idx_jobs_callback_analytics IS 'Optimizes callback rate analytics queries';
COMMENT ON INDEX idx_contacts_enrichment IS 'Optimizes finding contacts needing enrichment';
COMMENT ON INDEX idx_scraper_runs_status IS 'Optimizes scraper health monitoring queries';
