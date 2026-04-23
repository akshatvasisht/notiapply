
-- 1. Index on contacts(scraped_company_id) for FK JOIN performance.
--    idx_contacts_scraped_company_id was added in 20260320000000, so IF NOT EXISTS
--    makes this a safe no-op on up-to-date databases.
CREATE INDEX IF NOT EXISTS idx_contacts_scraped_company_id ON contacts(scraped_company_id);

-- 2. Fix contacts.job_id FK to use ON DELETE SET NULL.
--    The original constraint (contacts_job_id_fkey, created in 20260309100000) had no
--    ON DELETE clause, which means deleting a job would raise a FK violation instead of
--    nullifying the contact's job_id.  Postgres does not support ALTER CONSTRAINT to
--    change the ON DELETE action; we must drop and recreate.
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_job_id_fkey;
ALTER TABLE contacts
    ADD CONSTRAINT contacts_job_id_fkey
    FOREIGN KEY (job_id)
    REFERENCES jobs(id)
    ON DELETE SET NULL;

