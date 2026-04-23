-- Migration: Add company_logo_url column to jobs table
-- Created: 2026-03-04

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_logo_url TEXT;

COMMENT ON COLUMN jobs.company_logo_url IS 'URL to company logo image. Extracted from ATS APIs or manually added. NULL falls back to initials-based avatar.';

