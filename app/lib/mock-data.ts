/** Mock data for preview mode (database not connected).
 *
 * Policy: one record per visible UI surface. Keep it minimal.
 * Before adding a new fixture, ask whether an existing one already exercises the
 * same code path — if yes, don't add. If you must add, delete another first.
 *
 * Currently exercised:
 * - Jobs: 1 per board column (5) + docs-failed banner + callback-tracker UI + tracking state
 * - Contacts: 1 per CRM column (5) + drafted_message + overdue follow-up urgency
 */

import type { Job, Contact, UserConfig, PipelineModule, ScrapedCompany } from './types';

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60_000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60_000).toISOString();

// ─── Jobs (8) — covers all 5 columns + docs-failed + callback tracking ──────

export const MOCK_JOBS: Job[] = [
    {
        id: 1, source: 'jobspy-linkedin', title: 'Software Engineer', company: 'Vercel',
        location: 'Remote', url: 'https://vercel.com/careers',
        description_raw: 'Build Next.js and Vercel platform features. TypeScript, React, 3+ years experience.',
        salary_min: 140000, salary_max: 180000, equity_min: null, equity_max: null,
        company_role_location_hash: 'vercel-swe-remote', discovered_at: hoursAgo(2),
        docs_fail_reason: null, state: 'discovered', company_logo_url: null, updated_at: hoursAgo(2),
        got_callback: null, callback_notes: null, relevance_score: 82,
        score_breakdown: { reasons: ['TypeScript/React match'], red_flags: [], match_highlights: ['Next.js'] },
        is_live: true, liveness_checked_at: hoursAgo(1),
    },
    {
        id: 2, source: 'ats-greenhouse', title: 'Senior Backend Engineer', company: 'Stripe',
        location: 'San Francisco, CA', url: 'https://stripe.com/jobs/listing/senior-backend',
        description_raw: 'Payments infra. Go, Postgres, distributed systems. 5+ years.',
        salary_min: 180000, salary_max: 240000, equity_min: null, equity_max: null,
        company_role_location_hash: 'stripe-sbe-sf', discovered_at: daysAgo(1),
        docs_fail_reason: null, state: 'queued', company_logo_url: null, updated_at: hoursAgo(6),
        got_callback: null, callback_notes: null, relevance_score: 88,
        score_breakdown: { reasons: ['Backend match'], red_flags: [], match_highlights: ['Payments'] },
        is_live: true, liveness_checked_at: hoursAgo(3),
    },
    {
        id: 3, source: 'ats-lever', title: 'Staff Engineer', company: 'Figma',
        location: 'Remote', url: 'https://jobs.lever.co/figma/staff-eng',
        description_raw: 'Lead platform team. Browser internals, WebGL, collab tech.',
        salary_min: 210000, salary_max: 280000, equity_min: null, equity_max: null,
        company_role_location_hash: 'figma-staff-remote', discovered_at: daysAgo(2),
        docs_fail_reason: 'apply_diff: bullet remove text not found in master. Verify LLM output matches master resume.',
        state: 'docs-failed', company_logo_url: null, updated_at: hoursAgo(12),
        got_callback: null, callback_notes: null, relevance_score: 75,
        score_breakdown: null, is_live: true, liveness_checked_at: daysAgo(1),
    },
    {
        id: 4, source: 'github-simplify', title: 'New Grad SWE', company: 'Ramp',
        location: 'New York, NY', url: 'https://ramp.com/careers/new-grad-swe',
        description_raw: 'Fintech, new grad track. TypeScript, React.',
        salary_min: 120000, salary_max: 150000, equity_min: 0.01, equity_max: 0.05,
        company_role_location_hash: 'ramp-newgrad-ny', discovered_at: daysAgo(3),
        docs_fail_reason: null, state: 'review-incomplete', company_logo_url: null, updated_at: daysAgo(1),
        got_callback: null, callback_notes: null, relevance_score: 68,
        score_breakdown: null, is_live: true, liveness_checked_at: daysAgo(1),
    },
    {
        id: 5, source: 'ats-ashby', title: 'Frontend Engineer', company: 'Linear',
        location: 'Remote', url: 'https://jobs.ashbyhq.com/linear/frontend',
        description_raw: 'React + TypeScript. Product engineering for issue tracking.',
        salary_min: 160000, salary_max: 200000, equity_min: null, equity_max: null,
        company_role_location_hash: 'linear-fe-remote', discovered_at: daysAgo(4),
        docs_fail_reason: null, state: 'review-ready', company_logo_url: null, updated_at: daysAgo(1),
        got_callback: null, callback_notes: null, relevance_score: 90,
        score_breakdown: null, is_live: true, liveness_checked_at: daysAgo(1),
    },
    {
        id: 6, source: 'jobspy-indeed', title: 'Full Stack Engineer', company: 'Notion',
        location: 'San Francisco, CA', url: 'https://notion.com/careers/full-stack',
        description_raw: 'React, Node, Postgres. Shipping velocity matters.',
        salary_min: 170000, salary_max: 220000, equity_min: null, equity_max: null,
        company_role_location_hash: 'notion-fs-sf', discovered_at: daysAgo(10),
        docs_fail_reason: null, state: 'submitted', company_logo_url: null, updated_at: daysAgo(3),
        got_callback: true, callback_notes: 'Recruiter pinged — first-round call scheduled Thursday.',
        relevance_score: 84, score_breakdown: null, is_live: true, liveness_checked_at: daysAgo(1),
    },
    {
        id: 7, source: 'wellfound', title: 'Founding Engineer', company: 'Momento',
        location: 'San Francisco, CA', url: 'https://wellfound.com/l/momento-founding-eng',
        description_raw: 'Serverless caching infra. Rust, distributed systems.',
        salary_min: 150000, salary_max: 200000, equity_min: 0.5, equity_max: 1.5,
        company_role_location_hash: 'momento-fe-sf', discovered_at: daysAgo(14),
        docs_fail_reason: null, state: 'tracking', company_logo_url: null, updated_at: daysAgo(5),
        got_callback: null, callback_notes: null, relevance_score: 71,
        score_breakdown: null, is_live: true, liveness_checked_at: daysAgo(2),
    },
    {
        id: 8, source: 'ats-greenhouse', title: 'Backend Engineer', company: 'Plaid',
        location: 'Remote', url: 'https://plaid.com/careers/backend',
        description_raw: 'Fintech APIs. Python, Go.',
        salary_min: 160000, salary_max: 200000, equity_min: null, equity_max: null,
        company_role_location_hash: 'plaid-be-remote', discovered_at: daysAgo(30),
        docs_fail_reason: null, state: 'rejected', company_logo_url: null, updated_at: daysAgo(20),
        got_callback: false, callback_notes: 'Moved on with another candidate.',
        relevance_score: 62, score_breakdown: null, is_live: false, liveness_checked_at: daysAgo(10),
    },
];

// ─── Contacts (5) — one per CRM column + overdue follow-up ──────────────────

export const MOCK_CONTACTS: Contact[] = [
    {
        id: 1, name: 'Patrick Collison', role: 'CEO', company_name: 'Stripe',
        linkedin_url: 'https://linkedin.com/in/pcollison', personal_url: null,
        email: 'patrick@stripe.com', drafted_message: null, notes: 'CEO — shot in the dark.',
        state: 'identified', job_id: 2, scraped_company_id: null,
        created_at: daysAgo(1), updated_at: daysAgo(1),
        department: 'Executive', source: 'linkedin_search',
        follow_up_date: null, intro_source: null, last_contacted_at: null,
        interaction_log: [], got_response: null,
        company_funding_stage: 'Public', company_headcount_range: '5,001–10,000',
        company_industry: 'Fintech', company_notes: null,
        linkedin_posts_summary: null, drafted_subject: null, send_at: null, sent_at: null,
        bounce_type: null, bounce_reason: null, unsubscribed_at: null,
        enrichment: null, enrichment_status: 'pending', enriched_at: null,
    },
    {
        id: 2, name: 'Sarah Chen', role: 'Engineering Manager', company_name: 'Linear',
        linkedin_url: 'https://linkedin.com/in/sarahchen', personal_url: null,
        email: 'sarah@linear.app',
        drafted_message: 'Hi Sarah — I saw your post about scaling Linear\'s web client. I\'d love to talk about the frontend role on your team.',
        notes: null, state: 'drafted', job_id: 5, scraped_company_id: null,
        created_at: daysAgo(2), updated_at: daysAgo(1),
        department: 'Engineering', source: 'linkedin_search',
        follow_up_date: null, intro_source: null, last_contacted_at: null,
        interaction_log: [], got_response: null,
        company_funding_stage: 'Series C', company_headcount_range: '201–500',
        company_industry: 'Productivity', company_notes: null,
        linkedin_posts_summary: null, drafted_subject: 'Frontend role on Linear\'s web client team',
        send_at: null, sent_at: null, bounce_type: null, bounce_reason: null, unsubscribed_at: null,
        enrichment: null, enrichment_status: 'pending', enriched_at: null,
    },
    {
        id: 3, name: 'Diego Alvarez', role: 'Staff Engineer', company_name: 'Notion',
        linkedin_url: 'https://linkedin.com/in/diegoalvarez', personal_url: null,
        email: 'diego@notion.com', drafted_message: 'Sent via LinkedIn.',
        notes: 'Sent 10 days ago, no reply. Follow up.',
        state: 'contacted', job_id: 6, scraped_company_id: null,
        created_at: daysAgo(10), updated_at: daysAgo(10),
        department: 'Engineering', source: 'linkedin_search',
        follow_up_date: daysAgo(3), intro_source: 'cold LinkedIn', last_contacted_at: daysAgo(10),
        interaction_log: [{ timestamp: daysAgo(10), event: 'sent', notes: 'Initial LinkedIn DM.' }],
        got_response: null,
        company_funding_stage: 'Private', company_headcount_range: '501–1,000',
        company_industry: 'Productivity', company_notes: null,
        linkedin_posts_summary: null, drafted_subject: null,
        send_at: null, sent_at: daysAgo(10), bounce_type: null, bounce_reason: null, unsubscribed_at: null,
        enrichment: null, enrichment_status: 'pending', enriched_at: null,
    },
    {
        id: 4, name: 'Alex Rivera', role: 'VP Engineering', company_name: 'Ramp',
        linkedin_url: 'https://linkedin.com/in/alexrivera', personal_url: 'https://alexrivera.dev',
        email: 'alex@ramp.com', drafted_message: 'Sent initial outreach.',
        notes: 'Warm — replied with interview request.', state: 'replied',
        job_id: 4, scraped_company_id: null,
        created_at: daysAgo(14), updated_at: daysAgo(2),
        department: 'Engineering', source: 'linkedin_search',
        follow_up_date: null, intro_source: 'cold LinkedIn', last_contacted_at: daysAgo(14),
        interaction_log: [
            { timestamp: daysAgo(14), event: 'sent', notes: 'Initial outreach.' },
            { timestamp: daysAgo(2), event: 'replied', notes: 'Interested, asked about availability.' },
        ],
        got_response: true,
        company_funding_stage: 'Series D', company_headcount_range: '1,001–5,000',
        company_industry: 'Fintech', company_notes: null,
        linkedin_posts_summary: 'Writes about fintech infrastructure and scaling engineering orgs.',
        drafted_subject: null,
        send_at: null, sent_at: daysAgo(14), bounce_type: null, bounce_reason: null, unsubscribed_at: null,
        enrichment: {
            schema_version: 1,
            summary: 'Engineering leader with a focus on payments infra scaling.',
            topics: ['Payments', 'Engineering management'],
            tech_stack: ['Go', 'Postgres'],
            recent_themes: ['Org scaling', 'Oncall culture'],
        },
        enrichment_status: 'completed', enriched_at: daysAgo(5),
    },
    {
        id: 5, name: 'Taylor Kim', role: 'Recruiter', company_name: 'Plaid',
        linkedin_url: null, personal_url: null, email: 'taylor@plaid.com',
        drafted_message: null, notes: 'Rejected — moved on with another candidate.',
        state: 'rejected', job_id: 8, scraped_company_id: null,
        created_at: daysAgo(30), updated_at: daysAgo(20),
        department: 'Recruiting', source: 'job_description_email',
        follow_up_date: null, intro_source: null, last_contacted_at: daysAgo(25),
        interaction_log: [
            { timestamp: daysAgo(25), event: 'sent', notes: 'Applied + reached out.' },
            { timestamp: daysAgo(20), event: 'rejected', notes: 'Passed — moved on with another candidate.' },
        ],
        got_response: true,
        company_funding_stage: 'Public', company_headcount_range: '1,001–5,000',
        company_industry: 'Fintech', company_notes: null,
        linkedin_posts_summary: null, drafted_subject: null,
        send_at: null, sent_at: daysAgo(25), bounce_type: null, bounce_reason: null, unsubscribed_at: null,
        enrichment: null, enrichment_status: 'skipped', enriched_at: null,
    },
];

// ─── Minimal user config, modules, companies for Settings/CompaniesPage ─────

export const MOCK_CONFIG: UserConfig = {
    search_terms: ['software engineer', 'full stack'],
    locations: ['Remote', 'San Francisco'],
    github_repos: [],
    filter: { seniority: ['senior', 'staff'], new_grad_only: false, exclude_keywords: [], require_keywords: [] },
    relevance_threshold: 70,
    llm_endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    llm_model: 'gemini-1.5-flash',
    scrapers_enabled: ['jobspy', 'ats-direct', 'github', 'outreach-yc', 'outreach-github'],
    notifications_enabled: true,
};

export const MOCK_MODULES: PipelineModule[] = [
    {
        id: 1, key: 'filter', name: 'Filter', description: 'Score jobs against resume + prefs.',
        phase: 'processing', execution_order: 10, enabled: true, is_builtin: true,
        n8n_workflow_id: '10-filter', config_schema: null, module_config: {}, dependencies: [],
        created_at: daysAgo(30),
    },
    {
        id: 2, key: 'doc-generation', name: 'Doc Generation', description: 'Tailor resume via LaTeX.',
        phase: 'processing', execution_order: 20, enabled: true, is_builtin: true,
        n8n_workflow_id: '20-doc-gen', config_schema: null, module_config: {}, dependencies: ['filter'],
        created_at: daysAgo(30),
    },
];

export const MOCK_COMPANIES: ScrapedCompany[] = [
    { id: 1, name: 'Stripe', ats_platform: 'greenhouse', ats_slug: 'stripe', active: true, added_at: daysAgo(30) },
    { id: 2, name: 'Linear', ats_platform: 'ashby', ats_slug: 'linear', active: true, added_at: daysAgo(15) },
    { id: 3, name: 'Figma', ats_platform: 'lever', ats_slug: 'figma', active: false, added_at: daysAgo(60) },
];
