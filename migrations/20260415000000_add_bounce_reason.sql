-- Add bounce_reason column to store SMTP error detail
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS bounce_reason TEXT;
COMMENT ON COLUMN contacts.bounce_reason IS 'Full SMTP error message (e.g. "550 5.1.1 User not found")';
