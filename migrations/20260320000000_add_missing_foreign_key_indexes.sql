
-- Add missing indexes on foreign key columns for JOIN performance
-- Foreign keys without indexes cause table scans on parent tables during JOINs

CREATE INDEX IF NOT EXISTS idx_resume_diffs_application_id ON resume_diffs(application_id);
CREATE INDEX IF NOT EXISTS idx_contacts_job_id ON contacts(job_id);
CREATE INDEX IF NOT EXISTS idx_contacts_scraped_company_id ON contacts(scraped_company_id);

