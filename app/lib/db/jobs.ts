/** Job queries with fixes for F-01, H-01, H-02 */

import { createHash } from 'crypto';
import { getPool } from './pool';
import type { Job } from '../types';

/** F-01: Select only columns needed for list view (excludes multi-KB description_raw) */
const JOB_LIST_COLUMNS = `id, source, title, company, location, url, salary_min, salary_max,
    discovered_at, docs_fail_reason, state, company_logo_url, updated_at,
    got_callback, callback_notes`;

/** H-02: Validated set of job states */
const VALID_JOB_STATES: ReadonlySet<string> = new Set([
    'discovered', 'filtered-out', 'filtered', 'docs-failed', 'queued',
    'filling', 'fill-failed', 'review-incomplete', 'review-ready',
    'submitted', 'rejected', 'tracking',
]);

/** F-01 fix: getJobs no longer does SELECT *, uses column list + LIMIT */
export async function getJobs(limit = 500): Promise<Job[]> {
    const { rows } = await getPool().query(
        `SELECT ${JOB_LIST_COLUMNS} FROM jobs ORDER BY discovered_at DESC LIMIT $1`,
        [limit]
    );
    return rows;
}

export async function getJobById(id: number): Promise<Job | null> {
    const { rows } = await getPool().query('SELECT * FROM jobs WHERE id = $1', [id]);
    return rows[0] ?? null;
}

/** H-02 fix: validates state before update */
export async function updateJobState(id: number, state: string): Promise<void> {
    if (!VALID_JOB_STATES.has(state)) {
        throw new Error(`Invalid job state: "${state}". Valid: ${[...VALID_JOB_STATES].join(', ')}`);
    }
    await getPool().query('UPDATE jobs SET state = $1, updated_at = NOW() WHERE id = $2', [state, id]);
}

export async function updateJobCallback(
    id: number,
    gotCallback: boolean,
    notes: string
): Promise<void> {
    await getPool().query(
        'UPDATE jobs SET got_callback = $1, callback_notes = $2 WHERE id = $3',
        [gotCallback, notes, id]
    );
}

export async function addManualJob(job: {
    title: string;
    company: string;
    url: string;
    location: string;
    description: string;
}): Promise<number> {
    const hash = createHash('sha256')
        .update(`${job.title}|${job.company}|${job.location}`)
        .digest('hex');

    const { rows } = await getPool().query(
        `INSERT INTO jobs (source, title, company, location, url, description_raw, company_role_location_hash, state)
         VALUES ('manual', $1, $2, $3, $4, $5, $6, 'discovered')
         ON CONFLICT (company_role_location_hash) DO UPDATE SET url = EXCLUDED.url
         RETURNING id`,
        [job.title, job.company, job.location, job.url, job.description, hash]
    );
    return rows[0].id;
}

/** H-04: delete old rejected/filtered jobs based on user's archive_after_months setting */
export async function archiveOldJobs(months: number): Promise<number> {
    const { rowCount } = await getPool().query(
        `DELETE FROM jobs
         WHERE state IN ('rejected', 'filtered-out')
         AND discovered_at < NOW() - INTERVAL '1 month' * $1`,
        [months]
    );
    return rowCount ?? 0;
}

/** H-01 fix: recover jobs stuck in 'filling' state from sidecar crashes */
export async function recoverStuckJobs(staleMinutes = 30): Promise<number> {
    const { rowCount } = await getPool().query(
        `UPDATE jobs SET state = 'fill-failed', updated_at = NOW()
         WHERE state = 'filling'
         AND updated_at < NOW() - INTERVAL '1 minute' * $1`,
        [staleMinutes]
    );
    return rowCount ?? 0;
}
