/**
 * Shared test fixture factories for Notiapply unit tests.
 * Import from here instead of defining local makeX / daysX helpers in each test file.
 */
import type { Contact, Job, Application, UserConfig } from './types';

// ─── Date Helpers ────────────────────────────────────────────────────────────

export function daysAgo(n: number): string {
    return new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
}

export function daysFromNow(n: number): string {
    return new Date(Date.now() + n * 86400000).toISOString().split('T')[0];
}

// ─── Contact Factory ─────────────────────────────────────────────────────────

export function makeContact(overrides: Partial<Contact> = {}): Contact {
    return {
        id: 1,
        name: 'Test Person',
        role: null,
        company_name: 'Acme Corp',
        linkedin_url: null,
        email: null,
        drafted_message: null,
        notes: null,
        state: 'identified',
        job_id: null,
        scraped_company_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        follow_up_date: null,
        intro_source: null,
        last_contacted_at: null,
        interaction_log: [],
        got_response: null,
        company_funding_stage: null,
        company_headcount_range: null,
        company_industry: null,
        company_notes: null,
        linkedin_posts_summary: null,
        department: null,
        source: null,
        drafted_subject: null,
        send_at: null,
        sent_at: null,
        bounce_type: null,
        bounce_reason: null,
        unsubscribed_at: null,
        personal_url: null,
        enrichment: null,
        enrichment_status: 'pending',
        enriched_at: null,
        ...overrides,
    } as Contact;
}

// ─── Job Factory ─────────────────────────────────────────────────────────────

export function makeJob(overrides: Partial<Job> = {}): Job {
    return {
        id: 1,
        source: 'jobspy-linkedin',
        title: 'Software Engineer',
        company: 'Acme Corp',
        location: 'Remote',
        url: 'https://example.com/job/1',
        description_raw: 'A great job.',
        salary_min: null,
        salary_max: null,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'abc123',
        discovered_at: new Date(Date.now() - 86400000).toISOString(), // yesterday
        docs_fail_reason: null,
        state: 'discovered',
        company_logo_url: null,
        updated_at: new Date().toISOString(),
        got_callback: null,
        callback_notes: null,
        relevance_score: null,
        score_breakdown: null,
        is_live: true,
        liveness_checked_at: null,
        ...overrides,
    };
}

// ─── Application Factory ─────────────────────────────────────────────────────

export function makeApplication(overrides: Partial<Application> = {}): Application {
    return {
        id: 1,
        job_id: 1,
        master_resume_id: 1,
        cover_letter_template_id: null,
        resume_latex: null,
        resume_pdf: null,
        cover_letter_latex: null,
        cover_letter_pdf: null,
        application_email: null,
        ats_platform: null,
        fill_error_ats: null,
        incomplete_fields: null,
        fill_notes: null,
        queued_at: null,
        fill_started_at: null,
        fill_completed_at: null,
        submitted_at: null,
        created_at: new Date().toISOString(),
        draft_answers: null,
        ...overrides,
    };
}

// ─── UserConfig Factory ──────────────────────────────────────────────────────

export function makeUserConfig(overrides: Partial<UserConfig> = {}): UserConfig {
    return {
        llm_endpoint: 'https://api.openai.com/v1/chat/completions',
        llm_api_key: 'test-api-key',
        llm_model: 'gpt-4',
        crm_message_tone: 'professional',
        ...overrides,
    };
}
