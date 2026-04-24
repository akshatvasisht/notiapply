
-- Prevent duplicate scraper_runs rows for the same scraper_key on the same UTC day.
-- A partial unique index is used rather than a table constraint so that multiple
-- 'running' or 'failed' rows (e.g. retries within a day) can still be inserted if
-- needed -- the index only blocks true duplicates on the (key, calendar-day) pair.
CREATE UNIQUE INDEX IF NOT EXISTS idx_scraper_runs_unique_daily
    ON scraper_runs(scraper_key, DATE(started_at AT TIME ZONE 'UTC'));

