ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS drafted_subject TEXT,
    ADD COLUMN IF NOT EXISTS send_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS bounce_type TEXT CHECK (bounce_type IN ('hard', 'soft')),
    ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_email_queue ON contacts(send_at)
    WHERE send_at IS NOT NULL AND sent_at IS NULL AND bounce_type IS NULL;

