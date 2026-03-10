/** Notiapply — TypeScript types matching the Postgres schema */

export type JobState =
    | 'discovered' | 'filtered-out' | 'filtered' | 'docs-failed' | 'queued'
    | 'filling' | 'fill-failed' | 'review-incomplete' | 'review-ready'
    | 'submitted' | 'rejected' | 'tracking';

export type ContactState =
    | 'identified' | 'drafted' | 'contacted' | 'replied' | 'interviewing' | 'rejected';

export type JobSource =
    | 'jobspy-linkedin' | 'jobspy-indeed' | 'jobspy-glassdoor' | 'jobspy-ziprecruiter'
    | 'ats-greenhouse' | 'ats-lever' | 'ats-ashby'
    | 'github-simplify' | 'wellfound';

export type PipelinePhase = 'scraping' | 'processing' | 'output';

export interface Contact {
    id: number;
    name: string;
    role: string | null;
    company_name: string;
    linkedin_url: string | null;
    email: string | null;
    drafted_message: string | null;
    notes: string | null;
    state: ContactState;
    job_id: number | null;
    scraped_company_id: number | null;
    created_at: string;
    // Enrichment fields (populated by n8n pipeline)
    company_funding_stage: string | null;   // e.g. "Series C", "Public"
    company_headcount_range: string | null; // e.g. "501–1,000 employees"
    company_industry: string | null;        // e.g. "Artificial Intelligence"
    linkedin_posts_summary: string | null;  // LLM summary of recent posts
}


export interface Job {
    id: number;
    source: JobSource;
    title: string;
    company: string;
    location: string;
    url: string;
    description_raw: string;
    salary_min: number | null;
    salary_max: number | null;
    equity_min: number | null;
    equity_max: number | null;
    company_role_location_hash: string;
    discovered_at: string;
    docs_fail_reason: string | null;
    state: JobState;
    company_logo_url: string | null;
}

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
    ntfy_topic?: string;
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
    smtp_host?: string;
    smtp_port?: string;
    // Data Management
    archive_after_months?: number;
}

export interface ScrapedCompany {
    id: number;
    name: string;
    ats_platform: 'greenhouse' | 'lever' | 'ashby';
    ats_slug: string;
    active: boolean;
    added_at: string;
}

export interface FillSession {
    id: number;
    session_uuid: string;
    started_at: string;
    completed_at: string | null;
    jobs_attempted: number;
    jobs_filled: number;
    jobs_incomplete: number;
    jobs_failed: number;
    error_log: string | null;
}

/** Discriminated union for NDJSON events emitted by fill.js via stdout. */
export type SidecarEvent =
    | { event: 'preflight_failed'; errors: string[] }
    | { event: 'progress'; application_id: number; state: string; ats: string }
    | { event: 'incomplete'; application_id: number; ats: string; missing_fields: string[] }
    | { event: 'failed'; application_id: number; ats: string; reason: string }
    | { event: 'done'; session_id: string; filled: number; incomplete: number; failed: number };

export interface ATSFailure {
    ats_platform: string;
    fill_failed_count: number;
    review_incomplete_count: number;
    last_updated: string;
}

export interface AutomationStats {
    rate: number;
    automated: number;
    total: number;
}

export interface SourceCoverage {
    active: number;
    total: number;
}

/** Board column definitions */
export type BoardColumn = 'incoming' | 'ready' | 'attention' | 'submitted' | 'archive';

export const COLUMN_STATES: Record<BoardColumn, JobState[]> = {
    incoming: ['discovered'],
    ready: ['queued'],
    attention: ['review-incomplete', 'docs-failed', 'fill-failed'],
    submitted: ['review-ready', 'submitted', 'tracking'],
    archive: ['filtered-out', 'rejected'],
};

export const COLUMN_LABELS: Record<BoardColumn, string> = {
    incoming: 'Incoming',
    ready: 'Ready',
    attention: 'Attention',
    submitted: 'Submitted',
    archive: 'Archive',
};

export type ContactBoardColumn = 'identified' | 'drafted' | 'contacted' | 'replied' | 'rejected';

export const CONTACT_COLUMN_STATES: Record<ContactBoardColumn, ContactState[]> = {
    identified: ['identified'],
    drafted: ['drafted'],
    contacted: ['contacted'],
    replied: ['replied', 'interviewing'],
    rejected: ['rejected'],
};

export const CONTACT_COLUMN_LABELS: Record<ContactBoardColumn, string> = {
    identified: 'Prospects',
    drafted: 'Drafting',
    contacted: 'Reached Out',
    replied: 'Engaged',
    rejected: 'Closed',
};

/**
 * Channel tag styling for contact method chips — mirrors SOURCE_COLORS for jobs
 * LinkedIn = blue-ish, Email = teal-ish, None = neutral
 */
export const CONTACT_CHANNEL_COLORS = {
    linkedin: { text: '#0077B5', bg: '#E8F4FD' },
    email: { text: 'var(--color-secondary)', bg: 'var(--color-secondary-container)' },
};

/** Semantic color mapping for contact states — parallels SOURCE_COLORS for jobs */
export const CONTACT_STATE_COLORS: Record<ContactState, { text: string; bg: string }> = {
    identified: { text: 'var(--color-text-tertiary)', bg: 'var(--color-surface-container)' },
    drafted: { text: 'var(--color-primary)', bg: 'var(--color-primary-container)' },
    contacted: { text: 'var(--color-warning)', bg: 'var(--color-warning-container)' },
    replied: { text: 'var(--color-success)', bg: 'var(--color-success-container)' },
    interviewing: { text: 'var(--color-success)', bg: 'var(--color-success-container)' },
    rejected: { text: 'var(--color-text-tertiary)', bg: 'var(--color-surface-container)' },
};

export const CONTACT_STATE_LABELS: Record<ContactState, string> = {
    identified: 'Identified',
    drafted: 'Drafted',
    contacted: 'Contacted',
    replied: 'Replied',
    interviewing: 'Interviewing',
    rejected: 'Rejected',
};

/** Card left border colour based on contact state */
export function getContactBorderColor(state: ContactState): string {
    switch (state) {
        case 'drafted': return 'var(--color-primary)';
        case 'contacted': return 'var(--color-warning)';
        case 'replied':
        case 'interviewing': return 'var(--color-success)';
        case 'identified':
        case 'rejected':
        default: return 'transparent';
    }
}

/** Source tag colour mapping
 *
 * Color logic:
 * - Blue (primary): Job board aggregators (JobSpy scrapers)
 * - Green (success): Direct company ATS (Greenhouse, Lever, Ashby)
 * - Yellow (warning): Curated lists (GitHub repos)
 * - Purple (secondary): Startup platforms (Wellfound)
 */
export const SOURCE_COLORS: Record<string, { text: string; bg: string }> = {
    // Job board aggregators (Blue)
    'jobspy-linkedin': { text: 'var(--color-primary)', bg: 'var(--color-primary-container)' },
    'jobspy-indeed': { text: 'var(--color-primary)', bg: 'var(--color-primary-container)' },
    'jobspy-glassdoor': { text: 'var(--color-primary)', bg: 'var(--color-primary-container)' },
    'jobspy-ziprecruiter': { text: 'var(--color-primary)', bg: 'var(--color-primary-container)' },
    // Direct company ATS (Green)
    'ats-greenhouse': { text: 'var(--color-success)', bg: 'var(--color-success-container)' },
    'ats-lever': { text: 'var(--color-success)', bg: 'var(--color-success-container)' },
    'ats-ashby': { text: 'var(--color-success)', bg: 'var(--color-success-container)' },
    // Curated lists (Yellow)
    'github-simplify': { text: 'var(--color-warning)', bg: 'var(--color-warning-container)' },
    // Startup platforms (Purple/Secondary)
    'wellfound': { text: 'var(--color-secondary)', bg: 'var(--color-secondary-container)' },
};

export const SOURCE_LABELS: Record<string, string> = {
    'jobspy-linkedin': 'LinkedIn',
    'jobspy-indeed': 'Indeed',
    'jobspy-glassdoor': 'Glassdoor',
    'jobspy-ziprecruiter': 'ZipRecruiter',
    'ats-greenhouse': 'Greenhouse',
    'ats-lever': 'Lever',
    'ats-ashby': 'Ashby',
    'github-simplify': 'GitHub',
    'wellfound': 'Wellfound',
};

export const SOURCE_CATEGORIES = {
    aggregators: {
        name: 'Job Board Aggregators',
        color: 'primary',
        description: 'Broad coverage from major job boards (LinkedIn, Indeed, Glassdoor, ZipRecruiter). May contain duplicates and slower updates, but widest reach for discovering opportunities.',
        quality: 'Medium volume, potential duplicates',
        speed: 'Updates every 6-24 hours',
        sources: ['jobspy-linkedin', 'jobspy-indeed', 'jobspy-glassdoor', 'jobspy-ziprecruiter'],
    },
    ats: {
        name: 'Company ATS',
        color: 'success',
        description: 'Direct from company career pages via ATS APIs (Greenhouse, Lever, Ashby). Most reliable data quality, fastest application process, and up-to-date listings.',
        quality: 'High quality, no duplicates',
        speed: 'Real-time updates from company APIs',
        sources: ['ats-greenhouse', 'ats-lever', 'ats-ashby'],
    },
    curated: {
        name: 'Curated Lists',
        color: 'warning',
        description: 'Hand-picked postings from community-maintained GitHub repos (SimplifyJobs). High signal quality but competitive—many applicants use these lists.',
        quality: 'Manually vetted, new grad focused',
        speed: 'Updated daily by maintainers',
        sources: ['github-simplify'],
    },
    startups: {
        name: 'Startup Platforms',
        color: 'secondary',
        description: 'Early-stage companies from startup job boards (Wellfound). Often includes equity compensation details, higher risk/reward, and direct founder access.',
        quality: 'Startup-focused, equity info included',
        speed: 'Updated as startups post',
        sources: ['wellfound'],
    },
};

/** Card left border colour based on state */
export function getCardBorderColor(state: JobState): string {
    switch (state) {
        case 'queued':
        case 'review-ready':
            return 'var(--color-primary)';
        case 'review-incomplete':
        case 'docs-failed':
            return 'var(--color-warning)';
        case 'fill-failed':
            return 'var(--color-error)';
        case 'submitted':
        case 'tracking':
            return 'var(--color-success)';
        default:
            return 'transparent';
    }
}
