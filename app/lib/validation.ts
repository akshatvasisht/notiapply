/**
 * Runtime validation schemas using Zod
 *
 * These schemas validate data from external sources (database, APIs, user input)
 * to ensure type safety at runtime.
 */

import { z } from 'zod';

// ─── Enum Schemas ───────────────────────────────────────────────────────────

export const JobStateSchema = z.enum([
    'discovered',
    'filtered-out',
    'filtered',
    'docs-failed',
    'queued',
    'filling',
    'fill-failed',
    'review-incomplete',
    'review-ready',
    'submitted',
    'rejected',
    'tracking',
]);

export const ContactStateSchema = z.enum([
    'identified',
    'drafted',
    'contacted',
    'replied',
    'interviewing',
    'rejected',
]);

export const JobSourceSchema = z.enum([
    'jobspy-linkedin',
    'jobspy-indeed',
    'jobspy-glassdoor',
    'jobspy-ziprecruiter',
    'ats-greenhouse',
    'ats-lever',
    'ats-ashby',
    'github-simplify',
    'wellfound',
    'manual',
]);

export const LLMProviderSchema = z.enum(['openai', 'anthropic', 'gemini', 'local']);

export const ScraperStatusSchema = z.enum(['running', 'success', 'failed']);

// ─── Nested Object Schemas ──────────────────────────────────────────────────

export const InteractionLogEntrySchema = z.object({
    timestamp: z.string().datetime(),
    event: z.string().min(1),
    notes: z.string().optional(),
});

// ─── Main Entity Schemas ────────────────────────────────────────────────────

export const ContactSchema = z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    role: z.string().nullable(),
    company_name: z.string().min(1),
    linkedin_url: z.string().nullable(),
    email: z.string().email().nullable(),
    drafted_message: z.string().nullable(),
    notes: z.string().nullable(),
    state: ContactStateSchema,
    job_id: z.number().int().positive().nullable(),
    scraped_company_id: z.number().int().positive().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    follow_up_date: z.string().nullable(),
    intro_source: z.string().nullable(),
    last_contacted_at: z.string().datetime().nullable(),
    interaction_log: z.array(InteractionLogEntrySchema).default([]),
    got_response: z.boolean().nullable(),
    company_funding_stage: z.string().nullable(),
    company_headcount_range: z.string().nullable(),
    company_industry: z.string().nullable(),
    company_notes: z.string().nullable(),
    linkedin_posts_summary: z.string().nullable(),
    department: z.string().nullable(),
    source: z.string().nullable(),
    drafted_subject: z.string().nullable().default(null),
    send_at: z.string().datetime().nullable().default(null),
    sent_at: z.string().datetime().nullable().default(null),
    bounce_type: z.enum(['hard', 'soft']).nullable().default(null),
    bounce_reason: z.string().nullable().optional(),
    unsubscribed_at: z.string().datetime().nullable().default(null),
});

export const JobSchema = z.object({
    id: z.number().int().positive(),
    source: JobSourceSchema,
    title: z.string().min(1),
    company: z.string().min(1),
    location: z.string().min(1),
    url: z.string().url(),
    description_raw: z.string(),
    salary_min: z.number().int().nonnegative().nullable(),
    salary_max: z.number().int().nonnegative().nullable(),
    equity_min: z.number().nonnegative().nullable(),
    equity_max: z.number().nonnegative().nullable(),
    company_role_location_hash: z.string(),
    discovered_at: z.string().datetime(),
    docs_fail_reason: z.string().nullable(),
    state: JobStateSchema,
    company_logo_url: z.string().url().nullable(),
    updated_at: z.string().datetime(),
    got_callback: z.boolean().nullable(),
    callback_notes: z.string().nullable(),
    relevance_score: z.number().int().min(0).max(100).nullable().optional(),
    score_breakdown: z.object({
        reasons: z.array(z.string()),
        red_flags: z.array(z.string()),
        match_highlights: z.array(z.string()),
    }).nullable().optional(),
    is_live: z.boolean().default(true),
    liveness_checked_at: z.string().datetime().nullable().optional(),
});

export const ApplicationSchema = z.object({
    id: z.number().int().positive(),
    job_id: z.number().int().positive(),
    master_resume_id: z.number().int().positive(),
    cover_letter_template_id: z.number().int().positive().nullable(),
    resume_latex: z.string().nullable(),
    resume_pdf: z.instanceof(Uint8Array).nullable(),
    cover_letter_latex: z.string().nullable(),
    cover_letter_pdf: z.instanceof(Uint8Array).nullable(),
    application_email: z.string().email().nullable(),
    ats_platform: z.string().nullable(),
    fill_error_ats: z.string().nullable(),
    incomplete_fields: z.array(z.string()).nullable(),
    fill_notes: z.string().nullable(),
    queued_at: z.string().datetime().nullable(),
    fill_started_at: z.string().datetime().nullable(),
    fill_completed_at: z.string().datetime().nullable(),
    submitted_at: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
    draft_answers: z.array(z.object({
        question: z.string(),
        answer: z.string(),
    })).nullable().optional(),
});

export const UserConfigSchema = z.object({
    // Tokens & secrets
    github_token: z.string().optional(),
    ntfy_topic: z.string().optional(),
    cloudflare_email_domain: z.string().optional(),
    application_email_catch_all: z.string().optional(),
    ats_shared_password: z.string().optional(),
    linkedin_cookie: z.string().optional(),
    smtp_host: z.string().optional(),
    smtp_port: z.number().int().min(1).max(65535).optional(),
    smtp_user: z.string().optional(),
    smtp_password: z.string().optional(),
    smtp_from_name: z.string().optional(),
    smtp_from_email: z.string().email().optional(),
    smtp_secure: z.boolean().optional(),
    smtp_daily_limit: z.number().int().min(1).max(500).optional(),
    smtp_min_delay_minutes: z.number().min(1).max(120).optional(),
    physical_address: z.string().optional(),
    n8n_webhook_secret: z.string().optional(),
    // Search
    search_terms: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
    github_repos: z.array(z.string()).optional(),
    filter: z.object({
        seniority: z.array(z.string()).optional(),
        new_grad_only: z.boolean().optional(),
        exclude_keywords: z.array(z.string()).optional(),
        require_keywords: z.array(z.string()).optional(),
    }).optional(),
    // Webhooks & LLM
    n8n_webhook_url: z.string().url().optional(),
    llm_provider: LLMProviderSchema.optional(),
    llm_endpoint: z.string().url().optional(),
    llm_api_key: z.string().optional(),
    llm_model: z.string().optional(),
    // App state
    setup_complete: z.boolean().optional(),
    last_scrape_at: z.string().datetime().nullable().optional(),
    // CRM & Outreach
    crm_message_tone: z.string().optional(),
    // Data management
    archive_after_months: z.number().optional(),
    // Browser agent
    browser_agent_enabled: z.boolean().optional(),
    browser_agent_auto_login: z.boolean().optional(),
    browser_agent_fallback: z.boolean().optional(),
    browser_agent_max_tokens: z.number().optional(),
    browser_agent_temperature: z.number().min(0).max(2).optional(),
    browser_agent_action_timeout: z.number().optional(),
    // User profile
    user_email: z.string().email().optional(),
    user_email_password: z.string().optional(),
    user_first_name: z.string().optional(),
    user_last_name: z.string().optional(),
    user_phone: z.string().optional(),
    // ATS
    ats_password: z.string().optional(),
    // Email verification
    email_imap_host: z.string().optional(),
    email_imap_port: z.number().optional(),
    email_imap_secure: z.boolean().optional(),
    email_verification_timeout: z.number().optional(),
});

// ─── API Response Schemas ───────────────────────────────────────────────────

export const ScraperRunSchema = z.object({
    id: z.number().int().positive(),
    scraper_key: z.string().min(1),
    version: z.string().nullable(),
    status: ScraperStatusSchema,
    jobs_found: z.number().int().nonnegative().nullable(),
    errors: z.array(z.string()).nullable(),
    started_at: z.string().datetime(),
    completed_at: z.string().datetime().nullable(),
});

// ─── Validation Helper Functions ────────────────────────────────────────────

/**
 * Safely parse and validate data from database
 * Returns parsed data or throws descriptive error
 */
export function validateContact(data: unknown) {
    return ContactSchema.parse(data);
}

export function validateJob(data: unknown) {
    return JobSchema.parse(data);
}

export function validateApplication(data: unknown) {
    return ApplicationSchema.parse(data);
}

export function validateUserConfig(data: unknown) {
    return UserConfigSchema.parse(data);
}

/**
 * Safe parsing - returns { success: true, data } or { success: false, error }
 */
export function safeParseContact(data: unknown) {
    return ContactSchema.safeParse(data);
}

export function safeParseJob(data: unknown) {
    return JobSchema.safeParse(data);
}

export function safeParseApplication(data: unknown) {
    return ApplicationSchema.safeParse(data);
}

/**
 * Validate arrays of entities
 */
export function validateContacts(data: unknown) {
    return z.array(ContactSchema).parse(data);
}


// ─── Export Inferred Types ──────────────────────────────────────────────────

export type ValidatedContact = z.infer<typeof ContactSchema>;
export type ValidatedJob = z.infer<typeof JobSchema>;
export type ValidatedApplication = z.infer<typeof ApplicationSchema>;
export type ValidatedUserConfig = z.infer<typeof UserConfigSchema>;
export type ValidatedScraperRun = z.infer<typeof ScraperRunSchema>;
