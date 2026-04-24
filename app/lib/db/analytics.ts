/** Dashboard metrics & analytics queries */

import { getPool } from './pool';
import type { ATSFailure, AutomationStats, SourceCoverage, CallbackStats } from '../types';

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
