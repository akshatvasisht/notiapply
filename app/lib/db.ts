/** Notiapply — Database query layer
 *
 * Direct Postgres connection from the Tauri desktop app via pg.
 * All queries run client-side (this is a desktop app, not a web server).
 */

import { Pool } from 'pg';
import type { Job, Application, PipelineModule, UserConfig, ScrapedCompany } from './types';

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
    // Deactivate all existing
    await getPool().query('UPDATE master_resume SET is_active = false WHERE is_active = true');
    const { rows } = await getPool().query(
        'INSERT INTO master_resume (latex_source) VALUES ($1) RETURNING id',
        [latexSource]
    );
    return rows[0].id;
}

export async function uploadCoverLetterTemplate(latexSource: string): Promise<number> {
    await getPool().query('UPDATE cover_letter_templates SET is_active = false WHERE is_active = true');
    const { rows } = await getPool().query(
        'INSERT INTO cover_letter_templates (latex_source) VALUES ($1) RETURNING id',
        [latexSource]
    );
    return rows[0].id;
}
