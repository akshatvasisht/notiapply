-- migrate:up

-- user_config
CREATE TABLE user_config (
  id          INTEGER PRIMARY KEY DEFAULT 1,
  config      JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO user_config (config) VALUES ('{}');

-- pipeline_modules
CREATE TABLE pipeline_modules (
  id               SERIAL PRIMARY KEY,
  key              TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL,
  phase            TEXT NOT NULL CHECK (phase IN ('scraping', 'processing', 'output')),
  execution_order  INTEGER NOT NULL DEFAULT 0,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  is_builtin       BOOLEAN NOT NULL DEFAULT FALSE,
  n8n_workflow_id  TEXT NOT NULL,
  config_schema    JSONB,
  module_config    JSONB NOT NULL DEFAULT '{}',
  dependencies     TEXT[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pipeline_modules_phase_order ON pipeline_modules(phase, execution_order);

INSERT INTO pipeline_modules
  (key, name, description, phase, execution_order, enabled, is_builtin, n8n_workflow_id, config_schema, dependencies)
VALUES
('scrape-jobspy', 'Job Boards (JobSpy)', 'LinkedIn, Indeed, Glassdoor, ZipRecruiter via speedyapply/JobSpy.', 'scraping', 10, true, true, '01-scrape-jobspy', '{"type":"object","properties":{"sources":{"type":"array","title":"Active sources","items":{"type":"string","enum":["linkedin","indeed","glassdoor","zip_recruiter"]}},"results_per_source":{"type":"number","title":"Results per source","default":50}}}', '{}'),
('scrape-ats-direct', 'Company Watchlist (ATS Direct)', 'Greenhouse, Lever, and Ashby public APIs for companies in your watchlist.', 'scraping', 20, true, true, '02-scrape-ats-direct', NULL, '{}'),
('scrape-github', 'GitHub (SimplifyJobs)', 'SimplifyJobs/New-Grad-Positions — commit-polled markdown table.', 'scraping', 30, true, true, '03-scrape-github', NULL, '{}'),
('scrape-wellfound', 'Wellfound', 'Best-effort. Uses CF-Clearance-Scraper; breaks when Cloudflare updates.', 'scraping', 40, false, true, '04-scrape-wellfound', NULL, '{}'),
('filter', 'Filter', 'Location, seniority, and keyword filter applied before doc generation.', 'processing', 10, true, true, '05-filter', NULL, '{}'),
('doc-generation', 'Resume Tailoring', 'LLM diff against master resume + tectonic PDF compilation.', 'processing', 20, true, true, '06-doc-generation', NULL, '{}'),
('cover-letter', 'Cover Letter', 'LLM-expanded cover letter compiled to PDF. Requires Resume Tailoring.', 'processing', 30, true, true, '07-cover-letter', NULL, '{"doc-generation"}'),
('notifications', 'Notifications', 'ntfy.sh push notification when a scrape run completes with queued jobs.', 'output', 10, true, true, '08-notifications', NULL, '{}');

-- master_resume
CREATE TABLE master_resume (
  id SERIAL PRIMARY KEY, latex_source TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- cover_letter_templates
CREATE TABLE cover_letter_templates (
  id SERIAL PRIMARY KEY, latex_source TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- jobs
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY, source TEXT NOT NULL, title TEXT NOT NULL, company TEXT NOT NULL,
  location TEXT NOT NULL, url TEXT NOT NULL, description_raw TEXT NOT NULL,
  salary_min INTEGER, salary_max INTEGER, equity_min NUMERIC(5,2), equity_max NUMERIC(5,2),
  company_role_location_hash CHAR(64) NOT NULL UNIQUE,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), docs_fail_reason TEXT,
  state TEXT NOT NULL DEFAULT 'discovered'
    CHECK (state IN ('discovered','filtered-out','filtered','docs-failed','queued','filling','fill-failed','review-incomplete','review-ready','submitted','rejected','tracking'))
);
CREATE INDEX idx_jobs_state ON jobs(state);
CREATE INDEX idx_jobs_source ON jobs(source);
CREATE INDEX idx_jobs_discovered ON jobs(discovered_at DESC);

-- applications
CREATE TABLE applications (
  id SERIAL PRIMARY KEY, job_id INTEGER NOT NULL REFERENCES jobs(id),
  master_resume_id INTEGER NOT NULL REFERENCES master_resume(id),
  cover_letter_template_id INTEGER REFERENCES cover_letter_templates(id),
  resume_latex TEXT, resume_pdf BYTEA, cover_letter_latex TEXT, cover_letter_pdf BYTEA,
  application_email TEXT, ats_platform TEXT, fill_error_ats TEXT, incomplete_fields JSONB, fill_notes TEXT,
  queued_at TIMESTAMPTZ, fill_started_at TIMESTAMPTZ, fill_completed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_applications_job_id ON applications(job_id);

-- resume_diffs
CREATE TABLE resume_diffs (
  id SERIAL PRIMARY KEY, application_id INTEGER NOT NULL REFERENCES applications(id),
  llm_raw JSONB NOT NULL, bullets_swapped JSONB, keywords_added JSONB, cover_emphasis TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- fill_sessions
CREATE TABLE fill_sessions (
  id SERIAL PRIMARY KEY, session_uuid UUID NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ,
  jobs_attempted INTEGER NOT NULL DEFAULT 0, jobs_filled INTEGER NOT NULL DEFAULT 0,
  jobs_incomplete INTEGER NOT NULL DEFAULT 0, jobs_failed INTEGER NOT NULL DEFAULT 0, error_log TEXT
);

-- scraped_companies
CREATE TABLE scraped_companies (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL,
  ats_platform TEXT NOT NULL CHECK (ats_platform IN ('greenhouse','lever','ashby')),
  ats_slug TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (ats_platform, ats_slug)
);

-- github_poll_state
CREATE TABLE github_poll_state (
  repo TEXT PRIMARY KEY, last_commit_sha TEXT, last_polled_at TIMESTAMPTZ
);

-- ats_failure_counts view
CREATE VIEW ats_failure_counts AS
SELECT ats_platform,
  COUNT(*) FILTER (WHERE j.state = 'fill-failed') AS fill_failed_count,
  COUNT(*) FILTER (WHERE j.state = 'review-incomplete') AS review_incomplete_count,
  MAX(a.fill_completed_at) AS last_updated
FROM applications a JOIN jobs j ON j.id = a.job_id
WHERE a.ats_platform IS NOT NULL GROUP BY a.ats_platform;

-- migrate:down
DROP VIEW IF EXISTS ats_failure_counts;
DROP TABLE IF EXISTS resume_diffs;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS fill_sessions;
DROP TABLE IF EXISTS github_poll_state;
DROP TABLE IF EXISTS scraped_companies;
DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS cover_letter_templates;
DROP TABLE IF EXISTS master_resume;
DROP TABLE IF EXISTS pipeline_modules;
DROP TABLE IF EXISTS user_config;
