/** Notiapply — TypeScript types matching the Postgres schema */

export type JobState =
    | 'discovered' | 'filtered-out' | 'filtered' | 'docs-failed' | 'queued'
    | 'filling' | 'fill-failed' | 'review-incomplete' | 'review-ready'
    | 'submitted' | 'rejected' | 'tracking';

export type JobSource =
    | 'jobspy-linkedin' | 'jobspy-indeed' | 'jobspy-glassdoor' | 'jobspy-ziprecruiter'
    | 'ats-greenhouse' | 'ats-lever' | 'ats-ashby'
    | 'github-simplify' | 'wellfound';

export type PipelinePhase = 'scraping' | 'processing' | 'output';

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
    decodo_proxy?: string;
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

export interface SidecarEvent {
    event: 'progress' | 'incomplete' | 'failed' | 'done';
    application_id?: number;
    state?: string;
    ats?: string;
    missing_fields?: string[];
    reason?: string;
    session_id?: string;
    filled?: number;
    incomplete?: number;
    failed?: number;
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

/** Source tag colour mapping */
export const SOURCE_COLORS: Record<string, { text: string; bg: string }> = {
    'jobspy-linkedin': { text: 'var(--color-google-blue)', bg: 'var(--color-blue-tint)' },
    'jobspy-indeed': { text: 'var(--color-google-blue)', bg: 'var(--color-blue-tint)' },
    'jobspy-glassdoor': { text: 'var(--color-google-green)', bg: 'var(--color-green-tint)' },
    'jobspy-ziprecruiter': { text: 'var(--color-google-blue)', bg: 'var(--color-blue-tint)' },
    'ats-greenhouse': { text: 'var(--color-google-green)', bg: 'var(--color-green-tint)' },
    'ats-lever': { text: 'var(--color-google-green)', bg: 'var(--color-green-tint)' },
    'ats-ashby': { text: 'var(--color-google-green)', bg: 'var(--color-green-tint)' },
    'github-simplify': { text: 'var(--color-google-yellow)', bg: 'var(--color-yellow-tint)' },
    'wellfound': { text: 'var(--color-google-red)', bg: 'var(--color-red-tint)' },
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

/** Card left border colour based on state */
export function getCardBorderColor(state: JobState): string {
    switch (state) {
        case 'queued':
        case 'review-ready':
            return 'var(--color-google-blue)';
        case 'review-incomplete':
        case 'docs-failed':
            return 'var(--color-google-yellow)';
        case 'fill-failed':
            return 'var(--color-google-red)';
        case 'submitted':
        case 'tracking':
            return 'var(--color-google-green)';
        default:
            return 'transparent';
    }
}
