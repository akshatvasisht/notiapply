/** Contact queries */

import { getPool } from './pool';
import type { Contact } from '../types';

const VALID_CONTACT_STATES: ReadonlySet<string> = new Set([
    'identified', 'drafted', 'contacted', 'replied', 'interviewing', 'rejected',
]);

export async function getContacts(): Promise<Contact[]> {
    const { rows } = await getPool().query('SELECT * FROM contacts ORDER BY created_at DESC');
    return rows;
}

export async function getContactsDueForFollowUp(): Promise<Contact[]> {
    const { rows } = await getPool().query(
        `SELECT * FROM contacts
         WHERE follow_up_date <= CURRENT_DATE
         AND state IN ('contacted', 'replied')
         ORDER BY follow_up_date ASC`
    );
    return rows;
}

export async function updateContactState(id: number, state: string): Promise<void> {
    if (!VALID_CONTACT_STATES.has(state)) {
        throw new Error(`Invalid contact state: "${state}"`);
    }
    await getPool().query('UPDATE contacts SET state = $1, updated_at = NOW() WHERE id = $2', [state, id]);
}

export async function updateContactResponse(
    id: number,
    gotResponse: boolean
): Promise<void> {
    await getPool().query(
        'UPDATE contacts SET got_response = $1 WHERE id = $2',
        [gotResponse, id]
    );
}

export async function addContactInteraction(
    id: number,
    event: string,
    notes: string
): Promise<void> {
    await getPool().query(
        `UPDATE contacts
         SET interaction_log = COALESCE(interaction_log, '[]'::jsonb) ||
             jsonb_build_object('timestamp', NOW(), 'event', $1, 'notes', $2)::jsonb
         WHERE id = $3`,
        [event, notes, id]
    );
}

export async function updateContactNotes(id: number, notes: string): Promise<void> {
    await getPool().query(
        'UPDATE contacts SET notes = $1, updated_at = NOW() WHERE id = $2',
        [notes, id]
    );
}

/**
 * Queue a contact for re-enrichment by flipping its status back to 'pending'.
 * The next `enrich-contacts` pipeline run will pick it up even if it was
 * previously `completed`. Used by the "Refresh enrichment" action in
 * ContactDetail.tsx (C-01).
 */
export async function requestContactReenrichment(id: number): Promise<void> {
    await getPool().query(
        "UPDATE contacts SET enrichment_status = 'pending' WHERE id = $1",
        [id]
    );
}

export async function updateContactCompanyData(
    id: number,
    data: {
        company_industry?: string;
        company_headcount_range?: string;
        company_funding_stage?: string;
        company_notes?: string;
    }
): Promise<void> {
    await getPool().query(
        `UPDATE contacts
         SET company_industry = $1,
             company_headcount_range = $2,
             company_funding_stage = $3,
             company_notes = $4
         WHERE id = $5`,
        [data.company_industry, data.company_headcount_range, data.company_funding_stage, data.company_notes, id]
    );
}
