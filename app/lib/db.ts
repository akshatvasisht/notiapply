/** Notiapply — Database query layer
 *
 * Direct Postgres connection from the Tauri desktop app via pg.
 * All queries run client-side (this is a desktop app, not a web server).
 */

import { Pool } from 'pg';
import { createHash } from 'crypto';
import type { Job, Application, PipelineModule, UserConfig, ScrapedCompany, ATSFailure, AutomationStats, SourceCoverage, Contact, ScraperRun, CallbackStats } from './types';

let pool: Pool | null = null;

export function initPool(connectionString?: string): void {
    const dbUrl = connectionString || process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not set');
    pool = new Pool({ connectionString: dbUrl });
}

export function getPool(): Pool {
    if (!pool) {
        initPool();
    }
    return pool!;
}

export async function closePool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

// ─── User Config ───────────────────────────────────────────────────────────────

export async function getUserConfig(): Promise<UserConfig> {
    const { rows } = await getPool().query('SELECT config FROM user_config WHERE id = 1');
    return rows[0]?.config ?? {};
}

export async function updateUserConfig(config: UserConfig): Promise<void> {
    await getPool().query(
        'UPDATE user_config SET config = $1, updated_at = NOW() WHERE id = 1',
        [JSON.stringify(config)]
    );
}

// ─── Contacts ──────────────────────────────────────────────────────────────────

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
    await getPool().query('UPDATE contacts SET state = $1 WHERE id = $2', [state, id]);
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

// ─── Jobs ──────────────────────────────────────────────────────────────────────

export async function getJobs(): Promise<Job[]> {
    const { rows } = await getPool().query(
        'SELECT * FROM jobs ORDER BY discovered_at DESC'
    );
    return rows;
}

export async function getJobById(id: number): Promise<Job | null> {
    const { rows } = await getPool().query('SELECT * FROM jobs WHERE id = $1', [id]);
    return rows[0] ?? null;
}

export async function updateJobState(id: number, state: string): Promise<void> {
    await getPool().query('UPDATE jobs SET state = $1 WHERE id = $2', [state, id]);
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

// ─── Applications ──────────────────────────────────────────────────────────────

export async function getApplicationByJobId(jobId: number): Promise<Application | null> {
    const { rows } = await getPool().query(
        'SELECT * FROM applications WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1',
        [jobId]
    );
    return rows[0] ?? null;
}

// ─── Pipeline Modules ──────────────────────────────────────────────────────────

export async function getPipelineModules(): Promise<PipelineModule[]> {
    const { rows } = await getPool().query(
        `SELECT * FROM pipeline_modules
     ORDER BY
       CASE phase WHEN 'scraping' THEN 1 WHEN 'processing' THEN 2 WHEN 'output' THEN 3 END,
       execution_order ASC`
    );
    return rows;
}

export async function toggleModule(id: number, enabled: boolean): Promise<void> {
    await getPool().query(
        'UPDATE pipeline_modules SET enabled = $1 WHERE id = $2',
        [enabled, id]
    );
}

export async function updateModuleConfig(id: number, config: Record<string, unknown>): Promise<void> {
    await getPool().query(
        'UPDATE pipeline_modules SET module_config = $1 WHERE id = $2',
        [JSON.stringify(config), id]
    );
}

export async function updateModuleOrder(updates: { id: number; execution_order: number }[]): Promise<void> {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        for (const { id, execution_order } of updates) {
            await client.query(
                'UPDATE pipeline_modules SET execution_order = $1 WHERE id = $2',
                [execution_order, id]
            );
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

export async function addCustomModule(module: {
    key: string;
    name: string;
    description: string;
    phase: string;
    n8n_workflow_id: string;
    config_schema?: Record<string, unknown>;
}): Promise<void> {
    const maxOrder = await getPool().query(
        'SELECT COALESCE(MAX(execution_order), 0) + 10 AS next_order FROM pipeline_modules WHERE phase = $1',
        [module.phase]
    );
    await getPool().query(
        `INSERT INTO pipeline_modules (key, name, description, phase, execution_order, enabled, is_builtin, n8n_workflow_id, config_schema)
     VALUES ($1, $2, $3, $4, $5, true, false, $6, $7)`,
        [module.key, module.name, module.description, module.phase, maxOrder.rows[0].next_order, module.n8n_workflow_id, module.config_schema ? JSON.stringify(module.config_schema) : null]
    );
}

export async function deleteModule(id: number): Promise<void> {
    await getPool().query('DELETE FROM pipeline_modules WHERE id = $1 AND is_builtin = false', [id]);
}

// ─── Scraped Companies ─────────────────────────────────────────────────────────

export async function getScrapedCompanies(): Promise<ScrapedCompany[]> {
    const { rows } = await getPool().query('SELECT * FROM scraped_companies ORDER BY added_at DESC');
    return rows;
}

export async function addScrapedCompany(company: {
    name: string;
    ats_platform: string;
    ats_slug: string;
}): Promise<void> {
    await getPool().query(
        'INSERT INTO scraped_companies (name, ats_platform, ats_slug) VALUES ($1, $2, $3)',
        [company.name, company.ats_platform, company.ats_slug]
    );
}

export async function removeScrapedCompany(id: number): Promise<void> {
    await getPool().query('DELETE FROM scraped_companies WHERE id = $1', [id]);
}

// ─── Master Resume ─────────────────────────────────────────────────────────────

export async function uploadMasterResume(latexSource: string): Promise<number> {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        await client.query('UPDATE master_resume SET is_active = false WHERE is_active = true');
        const { rows } = await client.query(
            'INSERT INTO master_resume (latex_source) VALUES ($1) RETURNING id',
            [latexSource]
        );
        await client.query('COMMIT');
        return rows[0].id;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

export async function uploadCoverLetterTemplate(latexSource: string): Promise<number> {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        await client.query('UPDATE cover_letter_templates SET is_active = false WHERE is_active = true');
        const { rows } = await client.query(
            'INSERT INTO cover_letter_templates (latex_source) VALUES ($1) RETURNING id',
            [latexSource]
        );
        await client.query('COMMIT');
        return rows[0].id;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// ─── Dashboard Metrics ─────────────────────────────────────────────────────────

export async function getATSFailures(): Promise<ATSFailure[]> {
    try {
        const { rows } = await getPool().query(`
            SELECT
                ats_platform,
                fill_failed_count,
                review_incomplete_count,
                last_updated
            FROM ats_failure_counts
            WHERE fill_failed_count > 0 OR review_incomplete_count > 0
            ORDER BY fill_failed_count DESC
            LIMIT 3
        `);
        return rows;
    } catch {
        return []; // View might not exist yet or DB not connected
    }
}

export async function getAutomationStats(): Promise<AutomationStats> {
    try {
        const { rows } = await getPool().query(`
            SELECT
                COUNT(*) FILTER (WHERE state IN ('review-ready', 'submitted', 'tracking')) AS automated,
                COUNT(*) FILTER (WHERE state NOT IN ('filtered-out', 'rejected', 'discovered')) AS total_attempted
            FROM jobs
        `);

        const automated = parseInt(rows[0].automated) || 0;
        const total = parseInt(rows[0].total_attempted) || 0;
        const rate = total > 0 ? Math.round((automated / total) * 100) : 0;

        return { rate, automated, total };
    } catch {
        return { rate: 0, automated: 0, total: 0 };
    }
}

export async function getLastScrapeTime(): Promise<Date | null> {
    try {
        const { rows } = await getPool().query(`
            SELECT config->>'last_scrape_at' AS last_scrape
            FROM user_config
            WHERE id = 1
        `);

        return rows[0]?.last_scrape
            ? new Date(rows[0].last_scrape)
            : null;
    } catch {
        return null;
    }
}

export async function getSourceCoverage(): Promise<SourceCoverage> {
    try {
        const { rows } = await getPool().query(`
            SELECT
                COUNT(*) FILTER (WHERE enabled = true) AS active,
                COUNT(*) AS total
            FROM pipeline_modules
            WHERE phase = 'scraping' AND is_builtin = true
        `);

        return {
            active: parseInt(rows[0].active) || 0,
            total: parseInt(rows[0].total) || 4
        };
    } catch {
        return { active: 0, total: 4 }; // Default to 4 built-in scraping modules
    }
}

// ─── Scraper Run Tracking ──────────────────────────────────────────────────

export async function getLatestScraperRuns(): Promise<ScraperRun[]> {
    try {
        const { rows } = await getPool().query(`
            SELECT * FROM latest_scraper_runs
            ORDER BY started_at DESC
            LIMIT 10
        `);
        return rows;
    } catch {
        return [];
    }
}

export async function getFailedScraperRuns(): Promise<ScraperRun[]> {
    try {
        const { rows } = await getPool().query(`
            SELECT * FROM scraper_runs
            WHERE status = 'failed'
            ORDER BY started_at DESC
            LIMIT 5
        `);
        return rows;
    } catch {
        return [];
    }
}

export async function getScraperRuns(limit: number = 50): Promise<ScraperRun[]> {
    const { rows } = await getPool().query(
        'SELECT * FROM scraper_runs ORDER BY started_at DESC LIMIT $1',
        [limit]
    );
    return rows;
}

// ─── Analytics ─────────────────────────────────────────────────────────────────

export async function getCallbackAnalytics(): Promise<CallbackStats> {
    const { rows } = await getPool().query(`
        SELECT
            COUNT(*) as total_applications,
            COUNT(*) FILTER (WHERE got_callback = true) as total_callbacks,
            ROUND(
                100.0 * COUNT(*) FILTER (WHERE got_callback = true) / NULLIF(COUNT(*), 0),
                1
            ) as callback_rate
        FROM jobs
        WHERE state IN ('submitted', 'tracking')
    `);

    return {
        total_applications: parseInt(rows[0].total_applications),
        total_callbacks: parseInt(rows[0].total_callbacks),
        callback_rate: parseFloat(rows[0].callback_rate) || 0,
    };
}
