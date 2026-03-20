-- Migration: Add Browser Agent configuration fields to user_config
-- Description: Enables LLM-powered browser automation for ATS account creation,
--              auto-login, and form filling fallback. Reuses existing llm_* fields
--              for AI provider configuration.

-- +migrate Up

-- Add LLM provider enum value for local LLMs
-- Note: Cannot directly alter enum in transaction, but application handles 'local' gracefully

-- Add Browser Agent toggle flags
ALTER TABLE user_config
    ADD COLUMN IF NOT EXISTS browser_agent_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS browser_agent_auto_login BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS browser_agent_fallback BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS browser_agent_max_tokens INTEGER DEFAULT 4096,
    ADD COLUMN IF NOT EXISTS browser_agent_temperature NUMERIC(3,2) DEFAULT 0.1,
    ADD COLUMN IF NOT EXISTS browser_agent_action_timeout INTEGER DEFAULT 5000;

-- Add User Profile (single source of truth for ATS + email verification)
ALTER TABLE user_config
    ADD COLUMN IF NOT EXISTS user_email TEXT,             -- Primary email for everything
    ADD COLUMN IF NOT EXISTS user_email_password TEXT,    -- Email password for IMAP
    ADD COLUMN IF NOT EXISTS user_first_name TEXT,        -- For ATS signup
    ADD COLUMN IF NOT EXISTS user_last_name TEXT,         -- For ATS signup
    ADD COLUMN IF NOT EXISTS user_phone TEXT,             -- For ATS signup
    ADD COLUMN IF NOT EXISTS ats_password TEXT;           -- Separate password for ATS platforms

-- Add Email Verification Settings (optional overrides)
ALTER TABLE user_config
    ADD COLUMN IF NOT EXISTS email_imap_host TEXT,                              -- Manual IMAP override
    ADD COLUMN IF NOT EXISTS email_imap_port INTEGER,                           -- IMAP port (default: 993)
    ADD COLUMN IF NOT EXISTS email_imap_secure BOOLEAN DEFAULT true,            -- Use TLS
    ADD COLUMN IF NOT EXISTS email_verification_timeout INTEGER DEFAULT 120000; -- Timeout in ms

-- Add helpful comments
COMMENT ON COLUMN user_config.browser_agent_enabled IS 'Enable LLM-powered browser automation';
COMMENT ON COLUMN user_config.browser_agent_auto_login IS 'Auto-login and account creation';
COMMENT ON COLUMN user_config.browser_agent_fallback IS 'Fill fields Simplify misses';
COMMENT ON COLUMN user_config.browser_agent_max_tokens IS 'LLM max tokens for browser agent (default: 4096)';
COMMENT ON COLUMN user_config.browser_agent_temperature IS 'LLM temperature for browser agent (default: 0.1)';
COMMENT ON COLUMN user_config.browser_agent_action_timeout IS 'Timeout for browser actions in ms (default: 5000)';
COMMENT ON COLUMN user_config.user_email IS 'Primary email (ATS accounts + verification + CRM)';
COMMENT ON COLUMN user_config.user_email_password IS 'Email password for IMAP (app-specific password)';
COMMENT ON COLUMN user_config.ats_password IS 'Password for ATS platforms (encrypted)';
COMMENT ON COLUMN user_config.email_verification_timeout IS 'Max wait for verification email (ms)';

-- +migrate Down

-- Remove Browser Agent columns
ALTER TABLE user_config
    DROP COLUMN IF EXISTS browser_agent_enabled,
    DROP COLUMN IF EXISTS browser_agent_auto_login,
    DROP COLUMN IF EXISTS browser_agent_fallback,
    DROP COLUMN IF EXISTS browser_agent_max_tokens,
    DROP COLUMN IF EXISTS browser_agent_temperature,
    DROP COLUMN IF EXISTS browser_agent_action_timeout,
    DROP COLUMN IF EXISTS user_email,
    DROP COLUMN IF EXISTS user_email_password,
    DROP COLUMN IF EXISTS user_first_name,
    DROP COLUMN IF EXISTS user_last_name,
    DROP COLUMN IF EXISTS user_phone,
    DROP COLUMN IF EXISTS ats_password,
    DROP COLUMN IF EXISTS email_imap_host,
    DROP COLUMN IF EXISTS email_imap_port,
    DROP COLUMN IF EXISTS email_imap_secure,
    DROP COLUMN IF EXISTS email_verification_timeout;
