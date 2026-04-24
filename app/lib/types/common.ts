/** Notiapply — Shared/common TypeScript types */

export type PipelinePhase = 'scraping' | 'processing' | 'output';

/** Scraper keys enabled from the Settings → Sources toggles.
 *
 * These live in `user_config.scrapers_enabled` rather than as rows in
 * `pipeline_modules`, since every scraper has the same shape (enable/disable,
 * nothing to configure per-source beyond what lives in search_terms / locations).
 * n8n workflows should read this list and only call `/run/scrape-<key>` for
 * enabled entries.
 */
export const SCRAPER_KEYS = [
    'jobspy',
    'ats-direct',
    'github',
    'wellfound',
    'outreach-yc',
    'outreach-github',
] as const;
export type ScraperKey = typeof SCRAPER_KEYS[number];

export const SCRAPER_LABELS: Record<ScraperKey, string> = {
    'jobspy': 'Job Boards (JobSpy)',
    'ats-direct': 'Company Watchlist (ATS Direct)',
    'github': 'GitHub (SimplifyJobs)',
    'wellfound': 'Wellfound',
    'outreach-yc': 'Startup Founders (YC)',
    'outreach-github': 'Lead Engineering Strategy (GitHub)',
};

export interface Application {
    id: number;
    job_id: number;
    master_resume_id: number;
    cover_letter_template_id: number | null;
    resume_latex: string | null;
    resume_pdf: Uint8Array | null;
    cover_letter_latex: string | null;
    cover_letter_pdf: Uint8Array | null;
    application_email: string | null;
    ats_platform: string | null;
    fill_error_ats: string | null;
    incomplete_fields: string[] | null;
    fill_notes: string | null;
    queued_at: string | null;
    fill_started_at: string | null;
    fill_completed_at: string | null;
    submitted_at: string | null;
    created_at: string;
    draft_answers: Array<{ question: string; answer: string }> | null;
}

export interface PipelineModule {
    id: number;
    key: string;
    name: string;
    description: string;
    phase: PipelinePhase;
    execution_order: number;
    enabled: boolean;
    is_builtin: boolean;
    n8n_workflow_id: string;
    config_schema: Record<string, unknown> | null;
    module_config: Record<string, unknown>;
    dependencies: string[];
    created_at: string;
}

export interface UserConfig {
    github_token?: string;
    notifications_enabled?: boolean;
    scrapers_enabled?: ScraperKey[];
    cloudflare_email_domain?: string;
    application_email_catch_all?: string;
    ats_shared_password?: string;
    search_terms?: string[];
    locations?: string[];
    github_repos?: string[];
    filter?: {
        seniority?: string[];
        new_grad_only?: boolean;
        exclude_keywords?: string[];
        require_keywords?: string[];
    };
    relevance_threshold?: number;
    n8n_webhook_url?: string;
    n8n_webhook_secret?: string;
    llm_endpoint?: string;
    llm_api_key?: string;
    llm_model?: string;
    setup_complete?: boolean;
    last_scrape_at?: string | null;
    // CRM & Outreach settings
    crm_message_tone?: string;
    linkedin_cookie?: string;
    // SMTP cold email settings
    smtp_host?: string;
    smtp_port?: number;
    smtp_user?: string;
    smtp_password?: string;
    smtp_from_name?: string;
    smtp_from_email?: string;
    smtp_secure?: boolean;           // true = TLS (port 465), false = STARTTLS (port 587)
    smtp_daily_limit?: number;       // max emails per day (default 30)
    smtp_min_delay_minutes?: number; // min minutes between sends (default 10)
    physical_address?: string;       // CAN-SPAM required physical mailing address
    // Data Management
    archive_after_months?: number;
    // Browser Agent
    browser_agent_enabled?: boolean;
    browser_agent_auto_login?: boolean;
    browser_agent_fallback?: boolean;
    browser_agent_max_tokens?: number;        // LLM max tokens for browser agent (default: 4096)
    browser_agent_temperature?: number;       // LLM temperature for browser agent (default: 0.1)
    browser_agent_action_timeout?: number;    // Timeout for browser actions in ms (default: 5000)

    // User Profile (single source of truth for ATS signup + email verification)
    user_email?: string;          // Primary email for ATS accounts + verification
    user_email_password?: string; // Email password for IMAP (app-specific password)
    user_first_name?: string;     // Used for ATS account creation
    user_last_name?: string;      // Used for ATS account creation
    user_phone?: string;          // Used for ATS account creation

    // ATS Account Password (separate from email password)
    ats_password?: string;        // Password for ATS platforms (encrypted in database)

    // Email Verification Settings (optional overrides)
    email_imap_host?: string;              // Manual IMAP host override (auto-detected if not set)
    email_imap_port?: number;              // IMAP port (default: 993)
    email_imap_secure?: boolean;           // Use TLS (default: true)
    email_verification_timeout?: number;   // Timeout in milliseconds (default: 120000)
}
