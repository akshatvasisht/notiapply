/** Pool singleton with SSL support for remote connections (G-02) */

import { Pool } from 'pg';

let pool: Pool | null = null;

export function initPool(connectionString?: string): void {
    const dbUrl = connectionString || process.env.DATABASE_URL;
    if (!dbUrl) return; // No database configured — demo/mock mode
    const isRemote = dbUrl.includes('@') && !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1');
    pool = new Pool({
        connectionString: dbUrl,
        connectionTimeoutMillis: 5000,   // fail fast when DB is unreachable
        idleTimeoutMillis: 30000,
        statement_timeout: 10000,
        ...(isRemote ? { ssl: { rejectUnauthorized: false } } : {}),
    });
}

/** Returns true if DATABASE_URL is configured (no throw, no side effects). */
export function hasDatabase(): boolean {
    return !!(pool || process.env.DATABASE_URL);
}

export function getPool(): Pool {
    if (!pool) {
        initPool();
    }
    if (!pool) {
        throw new Error('DATABASE_URL not set — cannot connect to database');
    }
    return pool;
}

export async function closePool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
