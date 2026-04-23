/** Application queries */

import { getPool } from './pool';
import type { Application } from '../types';

export async function getApplicationByJobId(jobId: number): Promise<Application | null> {
    const { rows } = await getPool().query(
        'SELECT * FROM applications WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1',
        [jobId]
    );
    return rows[0] ?? null;
}

export async function updateApplicationDraftAnswers(
    applicationId: number,
    draftAnswers: Array<{ question: string; answer: string }>
): Promise<void> {
    await getPool().query(
        'UPDATE applications SET draft_answers = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(draftAnswers), applicationId]
    );
}

export async function updateApplicationNotes(appId: number, notes: string): Promise<void> {
    await getPool().query(
        'UPDATE applications SET fill_notes = $1, updated_at = NOW() WHERE id = $2',
        [notes, appId]
    );
}
