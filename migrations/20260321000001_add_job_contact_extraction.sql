
-- Add department and source tracking to contacts
ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS source TEXT;

COMMENT ON COLUMN contacts.department IS 'Department/function (Engineering, Product, Sales, etc.)';
COMMENT ON COLUMN contacts.source IS 'How this contact was discovered (job_description_email, linkedin_search, yc_scraper, etc.)';

-- Add job contact extraction pipeline module
INSERT INTO pipeline_modules
  (key, name, description, phase, execution_order, enabled, is_builtin, n8n_workflow_id, config_schema, dependencies)
VALUES
('extract-job-contacts', 'Job Posting Contact Extractor', 'Analyzes job descriptions to find embedded recruiter emails, hiring manager names, and LinkedIn profiles. Automatically discovers decision-makers from job posting text.', 'processing', 12, true, true, '12-extract-job-contacts', NULL, '{}')
ON CONFLICT (key) DO NOTHING;

