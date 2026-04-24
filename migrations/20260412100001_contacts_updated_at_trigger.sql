
-- contacts.updated_at column, trigger function, and trigger were already added in
-- 20260318000000_enhance_crm_and_observability.sql.  This migration is a safe no-op
-- that ensures the column and trigger exist in case an environment skipped that
-- migration or the schema was applied piecemeal.

ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill: if any rows ended up with NULL (only possible if the column was added
-- without a DEFAULT on a live table), set updated_at = created_at as a best guess.
UPDATE contacts SET updated_at = created_at WHERE updated_at IS NULL;

-- Make NOT NULL now that backfill is done (ALTER will fail gracefully if already NOT NULL).
-- Use a DO block so we can check pg_attribute instead of generating an error.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_attribute
         WHERE attrelid = 'contacts'::regclass
           AND attname    = 'updated_at'
           AND attnotnull = FALSE
    ) THEN
        ALTER TABLE contacts ALTER COLUMN updated_at SET NOT NULL;
    END IF;
END;
$$;

-- Trigger function: reuse update_updated_at_column() if it already exists (created in
-- 20260318000000).  CREATE OR REPLACE is idempotent, so this is always safe.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger only if it does not already exist.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
         WHERE tgname   = 'contacts_updated_at_trigger'
           AND tgrelid  = 'contacts'::regclass
    ) THEN
        CREATE TRIGGER contacts_updated_at_trigger
        BEFORE UPDATE ON contacts
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

