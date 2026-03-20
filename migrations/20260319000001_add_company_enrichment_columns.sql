-- Add company enrichment columns to contacts table
-- These fields allow manual enrichment of company data for better targeting

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS company_industry TEXT,
ADD COLUMN IF NOT EXISTS company_headcount_range TEXT,
ADD COLUMN IF NOT EXISTS company_funding_stage TEXT,
ADD COLUMN IF NOT EXISTS company_notes TEXT;

-- Add index for filtering by industry
CREATE INDEX IF NOT EXISTS idx_contacts_company_industry ON contacts(company_industry);
