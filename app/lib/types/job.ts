/** Notiapply — Job-related TypeScript types */

export type JobState =
    | 'discovered' | 'filtered-out' | 'filtered' | 'docs-failed' | 'queued'
    | 'filling' | 'fill-failed' | 'review-incomplete' | 'review-ready'
    | 'submitted' | 'rejected' | 'tracking';

export type JobSource =
    | 'jobspy-linkedin' | 'jobspy-indeed' | 'jobspy-glassdoor' | 'jobspy-ziprecruiter'
    | 'ats-greenhouse' | 'ats-lever' | 'ats-ashby'
    | 'github-simplify' | 'wellfound' | 'manual';

export type ScraperStatus = 'running' | 'success' | 'failed';

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
    updated_at: string;
    // Feedback tracking (new fields)
    got_callback: boolean | null;    // null=no response, true=callback/interview, false=rejected
    callback_notes: string | null;   // "They mentioned my X project", etc.
    relevance_score: number | null;
    score_breakdown: {
        reasons: string[];
        red_flags: string[];
        match_highlights: string[];
    } | null;
    is_live: boolean;
    liveness_checked_at: string | null;
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
    // Manual entry (Neutral)
    'manual': { text: 'var(--color-text-secondary)', bg: 'var(--color-surface-container)' },
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
    'manual': 'Manual',
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

export interface ScrapedCompany {
    id: number;
    name: string;
    ats_platform: 'greenhouse' | 'lever' | 'ashby';
    ats_slug: string;
    active: boolean;
    added_at: string;
}

export interface ScraperRun {
    id: number;
    scraper_key: string;
    started_at: string;
    completed_at: string | null;
    jobs_found: number;
    errors: string[] | null;
    status: ScraperStatus;
    version: string | null;
}

export interface CallbackStats {
    total_applications: number;
    total_callbacks: number;
    callback_rate: number;
}
