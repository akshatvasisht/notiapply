-- Notiapply — canonical schema.
-- Applied as a single init by deploy/docker/migrate.sh.

-- ════════════════════════════════════════════════════════════════════════════
-- Functions
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════════════════════════════════════════
-- user_config  (singleton row)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE user_config (
  id                            INTEGER PRIMARY KEY DEFAULT 1,
  config                        JSONB NOT NULL DEFAULT '{}',
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Browser agent (LLM-powered automation fallback)
  browser_agent_enabled         BOOLEAN DEFAULT false,
  browser_agent_auto_login      BOOLEAN DEFAULT false,
  browser_agent_fallback        BOOLEAN DEFAULT false,
  browser_agent_max_tokens      INTEGER DEFAULT 4096,
  browser_agent_temperature     NUMERIC(3,2) DEFAULT 0.1,
  browser_agent_action_timeout  INTEGER DEFAULT 5000,

  -- User profile (single source of truth for ATS signup + email verification)
  user_email                    TEXT,
  user_email_password           TEXT,
  user_first_name               TEXT,
  user_last_name                TEXT,
  user_phone                    TEXT,
  ats_password                  TEXT,

  -- Email verification (IMAP)
  email_imap_host               TEXT,
  email_imap_port               INTEGER,
  email_imap_secure             BOOLEAN DEFAULT true,
  email_verification_timeout    INTEGER DEFAULT 120000,

  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO user_config (config) VALUES ('{}');

COMMENT ON COLUMN user_config.browser_agent_enabled       IS 'Enable LLM-powered browser automation';
COMMENT ON COLUMN user_config.browser_agent_auto_login    IS 'Auto-login and account creation';
COMMENT ON COLUMN user_config.browser_agent_fallback      IS 'Fill fields Simplify misses';
COMMENT ON COLUMN user_config.user_email                  IS 'Primary email (ATS accounts + verification + CRM)';
COMMENT ON COLUMN user_config.user_email_password         IS 'Email password for IMAP (app-specific password)';
COMMENT ON COLUMN user_config.ats_password                IS 'Password for ATS platforms (encrypted at rest)';
COMMENT ON COLUMN user_config.email_verification_timeout  IS 'Max wait for verification email (ms)';

-- ════════════════════════════════════════════════════════════════════════════
-- pipeline_modules
-- ════════════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════════════
-- Resume + cover-letter templates
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE master_resume (
  id            SERIAL PRIMARY KEY,
  latex_source  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE cover_letter_templates (
  id            SERIAL PRIMARY KEY,
  latex_source  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

-- ════════════════════════════════════════════════════════════════════════════
-- Scraped companies + github poll state
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE scraped_companies (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  ats_platform  TEXT NOT NULL CHECK (ats_platform IN ('greenhouse','lever','ashby')),
  ats_slug      TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ats_platform, ats_slug)
);

CREATE TABLE github_poll_state (
  repo             TEXT PRIMARY KEY,
  last_commit_sha  TEXT,
  last_polled_at   TIMESTAMPTZ
);

-- ════════════════════════════════════════════════════════════════════════════
-- jobs
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE jobs (
  id                          SERIAL PRIMARY KEY,
  source                      TEXT NOT NULL,
  title                       TEXT NOT NULL,
  company                     TEXT NOT NULL,
  company_logo_url            TEXT,
  location                    TEXT NOT NULL,
  url                         TEXT NOT NULL,
  description_raw             TEXT NOT NULL,
  salary_min                  INTEGER,
  salary_max                  INTEGER,
  equity_min                  NUMERIC(5,2),
  equity_max                  NUMERIC(5,2),
  company_role_location_hash  CHAR(64) NOT NULL UNIQUE,
  relevance_score             SMALLINT,
  score_breakdown             JSONB,
  is_live                     BOOLEAN NOT NULL DEFAULT true,
  liveness_checked_at         TIMESTAMPTZ,
  got_callback                BOOLEAN,
  callback_notes              TEXT,
  docs_fail_reason            TEXT,
  state                       TEXT NOT NULL DEFAULT 'discovered'
    CHECK (state IN (
      'discovered','filtered-out','filtered','docs-failed','queued',
      'filling','fill-failed','review-incomplete','review-ready',
      'submitted','rejected','tracking'
    )),
  discovered_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_state              ON jobs(state);
CREATE INDEX idx_jobs_source             ON jobs(source);
CREATE INDEX idx_jobs_discovered         ON jobs(discovered_at DESC);
CREATE INDEX idx_jobs_updated_at         ON jobs(updated_at DESC);
CREATE INDEX idx_jobs_callback_analytics ON jobs(state, got_callback)
    WHERE state IN ('submitted', 'tracking');

COMMENT ON COLUMN jobs.source            IS 'Valid sources: jobspy-*, ats-*, github-simplify, wellfound, manual';
COMMENT ON COLUMN jobs.company_logo_url  IS 'URL to company logo. NULL falls back to initials-based avatar.';
COMMENT ON COLUMN jobs.got_callback      IS 'NULL = no response yet, TRUE = received callback/interview, FALSE = rejected';
COMMENT ON COLUMN jobs.callback_notes    IS 'Notes on what resonated during outreach/interview';
COMMENT ON COLUMN jobs.updated_at        IS 'For optimistic locking: detect concurrent UI/n8n writes';

CREATE TRIGGER jobs_updated_at_trigger
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ════════════════════════════════════════════════════════════════════════════
-- applications + resume_diffs + fill_sessions
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE applications (
  id                        SERIAL PRIMARY KEY,
  job_id                    INTEGER NOT NULL REFERENCES jobs(id),
  master_resume_id          INTEGER NOT NULL REFERENCES master_resume(id),
  cover_letter_template_id  INTEGER REFERENCES cover_letter_templates(id),
  resume_latex              TEXT,
  resume_pdf                BYTEA,
  cover_letter_latex        TEXT,
  cover_letter_pdf          BYTEA,
  application_email         TEXT,
  ats_platform              TEXT,
  fill_error_ats            TEXT,
  incomplete_fields         JSONB,
  fill_notes                TEXT,
  draft_answers             JSONB,
  queued_at                 TIMESTAMPTZ,
  fill_started_at           TIMESTAMPTZ,
  fill_completed_at         TIMESTAMPTZ,
  submitted_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_applications_job_id ON applications(job_id);

CREATE TABLE resume_diffs (
  id               SERIAL PRIMARY KEY,
  application_id   INTEGER NOT NULL REFERENCES applications(id),
  llm_raw          JSONB NOT NULL,
  bullets_swapped  JSONB,
  keywords_added   JSONB,
  cover_emphasis   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resume_diffs_application_id ON resume_diffs(application_id);

CREATE TABLE fill_sessions (
  id               SERIAL PRIMARY KEY,
  session_uuid     UUID NOT NULL UNIQUE,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  jobs_attempted   INTEGER NOT NULL DEFAULT 0,
  jobs_filled      INTEGER NOT NULL DEFAULT 0,
  jobs_incomplete  INTEGER NOT NULL DEFAULT 0,
  jobs_failed      INTEGER NOT NULL DEFAULT 0,
  error_log        TEXT
);

-- ════════════════════════════════════════════════════════════════════════════
-- contacts  (CRM)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE contacts (
  id                        SERIAL PRIMARY KEY,
  name                      TEXT NOT NULL,
  role                      TEXT,
  department                TEXT,
  company_name              TEXT NOT NULL,
  company_industry          TEXT,
  company_headcount_range   TEXT,
  company_funding_stage     TEXT,
  company_notes             TEXT,
  linkedin_url              TEXT,
  email                     TEXT,
  drafted_subject           TEXT,
  drafted_message           TEXT,
  send_at                   TIMESTAMPTZ,
  sent_at                   TIMESTAMPTZ,
  bounce_type               TEXT CHECK (bounce_type IN ('hard', 'soft')),
  bounce_reason             TEXT,
  unsubscribed_at           TIMESTAMPTZ,
  notes                     TEXT,
  source                    TEXT,
  intro_source              TEXT,
  follow_up_date            DATE,
  last_contacted_at         TIMESTAMPTZ,
  interaction_log           JSONB DEFAULT '[]',
  got_response              BOOLEAN,
  state                     TEXT NOT NULL DEFAULT 'identified'
    CHECK (state IN ('identified','drafted','contacted','replied','interviewing','rejected')),
  job_id                    INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  scraped_company_id        INTEGER REFERENCES scraped_companies(id),
  contact_hash              CHAR(64) UNIQUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_state              ON contacts(state);
CREATE INDEX idx_contacts_updated_at         ON contacts(updated_at DESC);
CREATE INDEX idx_contacts_job_id             ON contacts(job_id);
CREATE INDEX idx_contacts_scraped_company_id ON contacts(scraped_company_id);
CREATE INDEX idx_contacts_company_industry   ON contacts(company_industry);
CREATE INDEX idx_contacts_follow_up          ON contacts(follow_up_date)
    WHERE follow_up_date IS NOT NULL AND state IN ('contacted', 'replied');
CREATE INDEX idx_contacts_enrichment         ON contacts(company_name)
    WHERE company_industry IS NULL;
CREATE INDEX idx_contacts_email_queue        ON contacts(send_at)
    WHERE send_at IS NOT NULL AND sent_at IS NULL AND bounce_type IS NULL;

COMMENT ON COLUMN contacts.follow_up_date   IS 'When to next reach out (NULL = no follow-up scheduled)';
COMMENT ON COLUMN contacts.intro_source     IS 'How you met this person (warm intro, cold LinkedIn DM, YC founder list, etc.)';
COMMENT ON COLUMN contacts.interaction_log  IS 'Array of {timestamp, event, notes} objects tracking outreach history';
COMMENT ON COLUMN contacts.got_response     IS 'NULL = not yet contacted, TRUE = they replied, FALSE = ghosted';
COMMENT ON COLUMN contacts.department       IS 'Department/function (Engineering, Product, Sales, etc.)';
COMMENT ON COLUMN contacts.source           IS 'Discovery origin (job_description_email, linkedin_search, yc_scraper, etc.)';
COMMENT ON COLUMN contacts.bounce_reason    IS 'Full SMTP error detail (e.g. "550 5.1.1 User not found")';

CREATE TRIGGER contacts_updated_at_trigger
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ════════════════════════════════════════════════════════════════════════════
-- scraper_runs  (observability)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE scraper_runs (
  id            SERIAL PRIMARY KEY,
  scraper_key   TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  jobs_found    INTEGER DEFAULT 0,
  errors        TEXT[],
  status        TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed')),
  version       TEXT
);

CREATE INDEX idx_scraper_runs_key_started ON scraper_runs(scraper_key, started_at DESC);
CREATE INDEX idx_scraper_runs_status      ON scraper_runs(status, started_at DESC)
    WHERE status IN ('running', 'failed');
CREATE UNIQUE INDEX idx_scraper_runs_unique_daily
    ON scraper_runs(scraper_key, DATE(started_at AT TIME ZONE 'UTC'));

COMMENT ON TABLE  scraper_runs         IS 'Scraper execution log: detect silent failures via 0 jobs_found on normally-productive scrapers';
COMMENT ON COLUMN scraper_runs.version IS 'Git commit hash or package version for debugging regressions';

-- ════════════════════════════════════════════════════════════════════════════
-- Views
-- ════════════════════════════════════════════════════════════════════════════

CREATE VIEW ats_failure_counts AS
SELECT a.ats_platform,
       COUNT(*) FILTER (WHERE j.state = 'fill-failed')        AS fill_failed_count,
       COUNT(*) FILTER (WHERE j.state = 'review-incomplete')  AS review_incomplete_count,
       MAX(a.fill_completed_at)                               AS last_updated
  FROM applications a
  JOIN jobs j ON j.id = a.job_id
 WHERE a.ats_platform IS NOT NULL
 GROUP BY a.ats_platform;

CREATE VIEW latest_scraper_runs AS
SELECT DISTINCT ON (scraper_key)
       scraper_key, started_at, completed_at, jobs_found, errors, status
  FROM scraper_runs
 ORDER BY scraper_key, started_at DESC;

-- ════════════════════════════════════════════════════════════════════════════
-- Seed: built-in pipeline modules
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO pipeline_modules
  (key, name, description, phase, execution_order, enabled, is_builtin, n8n_workflow_id, config_schema, dependencies)
VALUES
  ('scrape-jobspy',
   'Job Boards (JobSpy)',
   'LinkedIn, Indeed, Glassdoor, ZipRecruiter via speedyapply/JobSpy.',
   'scraping', 10, true, true, '01-scrape-jobspy',
   '{"type":"object","properties":{"sources":{"type":"array","title":"Active sources","items":{"type":"string","enum":["linkedin","indeed","glassdoor","zip_recruiter"]}},"results_per_source":{"type":"number","title":"Results per source","default":50}}}'::jsonb,
   '{}'),

  ('scrape-ats-direct',
   'Company Watchlist (ATS Direct)',
   'Greenhouse, Lever, and Ashby public APIs for companies in your watchlist.',
   'scraping', 20, true, true, '02-scrape-ats-direct',
   NULL, '{}'),

  ('scrape-github',
   'GitHub (SimplifyJobs)',
   'SimplifyJobs/New-Grad-Positions — commit-polled markdown table.',
   'scraping', 30, true, true, '03-scrape-github',
   NULL, '{}'),

  ('scrape-wellfound',
   'Wellfound',
   'Best-effort. Uses CF-Clearance-Scraper; breaks when Cloudflare updates.',
   'scraping', 40, false, true, '04-scrape-wellfound',
   NULL, '{}'),

  ('scrape-outreach-yc',
   'Startup Founders (YC)',
   'Scrapes founder names and LinkedIn pages dynamically from YCombinator based on user-defined slugs.',
   'scraping', 50, true, true, '13-scrape-outreach-yc',
   '{"type":"object","properties":{"yc_slugs":{"type":"array","title":"Target YC Slugs","items":{"type":"string"}}}}'::jsonb,
   '{}'),

  ('scrape-outreach-github',
   'Lead Engineering Strategy (GitHub)',
   'Polls open-source GitHub organizations to find primary contributors and scrape their public email + name for direct cold outreach.',
   'scraping', 60, true, true, '10-scrape-outreach-github',
   '{"type":"object","properties":{"github_orgs":{"type":"array","title":"Target GitHub Orgs","items":{"type":"string"}}}}'::jsonb,
   '{}'),

  ('liveness-check',
   'Liveness Check',
   'HEAD-checks job URLs to detect dead postings (404/410, redirect-to-listing, stale phrasing). Marks dead jobs is_live=false and transitions to filtered-out.',
   'processing', 5, true, true, '09-liveness-check',
   NULL, '{}'),

  ('filter',
   'Filter',
   'Location, seniority, and keyword filter applied before doc generation.',
   'processing', 10, true, true, '05-filter',
   NULL, '{}'),

  ('extract-job-contacts',
   'Job Posting Contact Extractor',
   'Analyzes job descriptions to find embedded recruiter emails, hiring manager names, and LinkedIn profiles. Automatically surfaces decision-makers from job posting text.',
   'processing', 12, true, true, '12-extract-job-contacts',
   NULL, '{}'),

  ('outreach-drafting',
   'Outreach Drafter',
   'Drafts 2-sentence cold emails for startup contacts.',
   'processing', 15, true, true, '11-outreach-drafting',
   '{"type":"object","properties":{"batch_size":{"type":"integer","title":"Contacts per run","default":25,"minimum":1,"maximum":200}}}'::jsonb,
   '{}'),

  ('doc-generation',
   'Resume Tailoring',
   'LLM diff against master resume + tectonic PDF compilation.',
   'processing', 20, true, true, '06-doc-generation',
   NULL, '{}'),

  ('cover-letter',
   'Cover Letter',
   'LLM-expanded cover letter compiled to PDF. Requires Resume Tailoring.',
   'processing', 30, true, true, '07-cover-letter',
   NULL, '{"doc-generation"}'),

  ('notifications',
   'Notifications',
   'ntfy.sh push notification when a scrape run completes with queued jobs.',
   'output', 10, true, true, '08-notifications',
   '{"type":"object","properties":{"title":{"type":"string","title":"Notification title","default":"Notiapply"},"message":{"type":"string","title":"Override message (otherwise auto-summary)"},"priority":{"type":"string","title":"Priority","enum":["min","low","default","high","urgent"],"default":"default"},"tags":{"type":"array","title":"Tags","items":{"type":"string"}}}}'::jsonb,
   '{}');
