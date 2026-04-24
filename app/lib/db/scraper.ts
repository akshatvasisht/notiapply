/** Scraper run tracking queries */

import { getPool } from './pool';
import type { ScraperRun } from '../types';

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
