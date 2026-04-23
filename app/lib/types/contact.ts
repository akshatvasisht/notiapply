/** Notiapply — Contact-related TypeScript types */

export type ContactState =
    | 'identified' | 'drafted' | 'contacted' | 'replied' | 'interviewing' | 'rejected';

export interface InteractionLogEntry {
    timestamp: string;
    event: string;
    notes?: string;
}

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
    updated_at: string;
    // Contact discovery metadata
    department: string | null;              // Engineering, Product, Sales, etc.
    source: string | null;                  // job_description_email, linkedin_search, yc_scraper, etc.
    // Outreach tracking (new fields)
    follow_up_date: string | null;          // ISO date string
    intro_source: string | null;            // "warm intro via X", "cold LinkedIn", etc.
    last_contacted_at: string | null;       // TIMESTAMPTZ
    interaction_log: InteractionLogEntry[]; // [{timestamp, event, notes}, ...]
    got_response: boolean | null;           // null=not contacted, true=replied, false=ghosted
    // Enrichment fields (populated by n8n pipeline)
    company_funding_stage: string | null;   // e.g. "Series C", "Public"
    company_headcount_range: string | null; // e.g. "501–1,000 employees"
    company_industry: string | null;        // e.g. "Artificial Intelligence"
    company_notes: string | null;           // Manual notes about the company
    linkedin_posts_summary: string | null;  // LLM summary of recent posts
    // Email sending fields
    drafted_subject: string | null;
    send_at: string | null;          // ISO TIMESTAMPTZ — scheduled send time
    sent_at: string | null;          // ISO TIMESTAMPTZ — actual send time
    bounce_type: 'hard' | 'soft' | null;
    bounce_reason: string | null;
    unsubscribed_at: string | null;
}

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

export type UrgencyTier = 'critical' | 'overdue' | 'upcoming' | 'none';

export const URGENCY_COLORS: Record<UrgencyTier, { text: string; bg: string; border: string }> = {
    critical: { text: 'var(--color-error)', bg: 'var(--color-error-container)', border: 'var(--color-error)' },
    overdue:  { text: 'var(--color-warning)', bg: 'var(--color-warning-container)', border: 'var(--color-warning)' },
    upcoming: { text: 'var(--color-primary)', bg: 'var(--color-primary-container)', border: 'var(--color-primary)' },
    none:     { text: 'transparent', bg: 'transparent', border: 'transparent' },
};

/** Compute follow-up urgency tier from existing Contact fields. No DB changes needed. */
export function getUrgencyTier(contact: Contact): UrgencyTier {
    if (!contact.follow_up_date || !(['contacted', 'replied'] as ContactState[]).includes(contact.state)) return 'none';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const followUp = new Date(contact.follow_up_date);
    followUp.setHours(0, 0, 0, 0);
    const daysUntil = Math.floor((followUp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (contact.got_response && daysUntil < 0) return 'critical';
    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 3) return 'upcoming';
    return 'none';
}
