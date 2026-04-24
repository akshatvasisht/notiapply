-- Drop the unique constraint that blocks scrapers on their 2nd UTC-day run.
-- n8n runs scrapers every 6h → 4 runs/day. The unique index raised
-- UniqueViolation on runs #2–#4, which base_scraper's try/except Exception
-- converted to a RuntimeError → FastAPI 500. scrapers silently stopped after
-- the first daily run.
--
-- scraper_runs is an append-only log; one row per run is the correct semantic.
DROP INDEX IF EXISTS idx_scraper_runs_unique_daily;

-- Replace with a non-unique index for query performance on "runs per day" dashboards.
CREATE INDEX IF NOT EXISTS idx_scraper_runs_scraper_day
    ON scraper_runs (scraper_key, DATE(started_at AT TIME ZONE 'UTC'));
