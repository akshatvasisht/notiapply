/** Pipeline module queries */

import { getPool } from './pool';
import type { PipelineModule } from '../types';

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
