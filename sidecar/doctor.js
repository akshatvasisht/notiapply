#!/usr/bin/env node
/**
 * Notiapply Setup Validator
 *
 * Validates environment, file paths, database connectivity, schema, and config.
 * Run from project root: node sidecar/doctor.js
 */

'use strict';

const fs = require('fs');
const pg = require('pg');

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------
const PASS = '\x1b[32m[PASS]\x1b[0m';
const FAIL = '\x1b[31m[FAIL]\x1b[0m';
const WARN = '\x1b[33m[WARN]\x1b[0m';
const SKIP = '\x1b[90m[SKIP]\x1b[0m';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
let warnings = 0;
let total = 0;

function pass(msg) {
    passed++;
    total++;
    console.log(`${PASS} ${msg}`);
}

function fail(msg) {
    failed++;
    total++;
    console.log(`${FAIL} ${msg}`);
}

function warn(msg) {
    warnings++;
    total++;
    console.log(`${WARN} ${msg}`);
}

function skip(msg) {
    console.log(`${SKIP} ${msg}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
    console.log('\n=== Notiapply Setup Validator ===\n');

    // -----------------------------------------------------------------------
    // Checks 1-3: Environment variables
    // -----------------------------------------------------------------------
    const DATABASE_URL = process.env.DATABASE_URL;
    const CHROMIUM_EXECUTABLE_PATH = process.env.CHROMIUM_EXECUTABLE_PATH;
    const SIMPLIFY_EXTENSION_PATH = process.env.SIMPLIFY_EXTENSION_PATH;

    if (DATABASE_URL) {
        pass('DATABASE_URL is set');
    } else {
        fail('DATABASE_URL is not set');
    }

    if (CHROMIUM_EXECUTABLE_PATH) {
        pass('CHROMIUM_EXECUTABLE_PATH is set');
    } else {
        fail('CHROMIUM_EXECUTABLE_PATH is not set');
    }

    if (SIMPLIFY_EXTENSION_PATH) {
        pass('SIMPLIFY_EXTENSION_PATH is set');
    } else {
        fail('SIMPLIFY_EXTENSION_PATH is not set');
    }

    // -----------------------------------------------------------------------
    // Check 4: Chromium binary exists
    // -----------------------------------------------------------------------
    if (CHROMIUM_EXECUTABLE_PATH) {
        if (fs.existsSync(CHROMIUM_EXECUTABLE_PATH)) {
            pass(`Chromium binary found: ${CHROMIUM_EXECUTABLE_PATH}`);
        } else {
            fail(`Chromium binary not found: ${CHROMIUM_EXECUTABLE_PATH}`);
        }
    } else {
        skip('Chromium path check skipped (CHROMIUM_EXECUTABLE_PATH not set)');
    }

    // -----------------------------------------------------------------------
    // Check 5: Simplify extension directory exists
    // -----------------------------------------------------------------------
    if (SIMPLIFY_EXTENSION_PATH) {
        if (fs.existsSync(SIMPLIFY_EXTENSION_PATH)) {
            pass(`Simplify extension found: ${SIMPLIFY_EXTENSION_PATH}`);
        } else {
            fail(`Simplify extension not found: ${SIMPLIFY_EXTENSION_PATH}`);
        }
    } else {
        skip('Simplify extension check skipped (SIMPLIFY_EXTENSION_PATH not set)');
    }

    // -----------------------------------------------------------------------
    // Check 6: Database connectivity
    // -----------------------------------------------------------------------
    let dbOk = false;
    let pool = null;
    let tablesPresent = new Set();

    if (!DATABASE_URL) {
        skip('Database checks skipped (DATABASE_URL not set)');
    } else {
        pool = new pg.Pool({
            connectionString: DATABASE_URL,
            connectionTimeoutMillis: 5000,
        });

        try {
            const res = await pool.query('SELECT version()');
            const versionStr = res.rows[0].version || '';
            // Extract "PostgreSQL X.Y.Z" from the full version string
            const match = versionStr.match(/PostgreSQL\s+([\d.]+)/i);
            const versionShort = match ? match[1] : versionStr.split(' ')[0];
            pass(`Database connection successful (PostgreSQL ${versionShort})`);
            dbOk = true;
        } catch (err) {
            fail(`Database connection failed: ${err.message}`);
        }

        // -------------------------------------------------------------------
        // Check 7: Required tables exist
        // -------------------------------------------------------------------
        if (dbOk) {
            const required = ['jobs', 'contacts', 'user_config', 'scraper_runs', 'pipeline_modules'];
            try {
                const res = await pool.query(
                    `SELECT table_name FROM information_schema.tables
                     WHERE table_schema = 'public' AND table_name = ANY($1)`,
                    [required]
                );
                tablesPresent = new Set(res.rows.map(r => r.table_name));
                const missing = required.filter(t => !tablesPresent.has(t));
                if (missing.length === 0) {
                    pass(`Required tables exist: ${required.join(', ')}`);
                } else {
                    fail(`Missing tables: ${missing.join(', ')}`);
                }
            } catch (err) {
                fail(`Table check failed: ${err.message}`);
            }
        }

        // -------------------------------------------------------------------
        // Check 8: Pipeline modules
        // -------------------------------------------------------------------
        if (dbOk) {
            if (!tablesPresent.has('pipeline_modules')) {
                skip('Pipeline modules check skipped (pipeline_modules table missing)');
            } else {
                try {
                    const res = await pool.query(
                        `SELECT COUNT(*) FILTER (WHERE enabled) AS enabled_count,
                                COUNT(*) FILTER (WHERE NOT enabled) AS disabled_count
                         FROM pipeline_modules`
                    );
                    const { enabled_count, disabled_count } = res.rows[0];
                    pass(`Pipeline modules: ${enabled_count} enabled, ${disabled_count} disabled`);
                } catch (err) {
                    fail(`Pipeline modules check failed: ${err.message}`);
                }
            }
        }

        // -------------------------------------------------------------------
        // Check 9: Master resume
        // -------------------------------------------------------------------
        if (dbOk) {
            try {
                const res = await pool.query('SELECT COUNT(*) FROM master_resumes');
                const count = parseInt(res.rows[0].count, 10);
                if (count > 0) {
                    pass(`Master resume found (${count} resume(s))`);
                } else {
                    warn('No master resume found — upload a resume in Settings before filling applications');
                }
            } catch (err) {
                // Table may not exist yet; treat as warning
                warn(`Master resume check skipped: ${err.message}`);
            }
        }

        // -------------------------------------------------------------------
        // Check 10: LLM config (warning only)
        // -------------------------------------------------------------------
        if (dbOk) {
            if (!tablesPresent.has('user_config')) {
                skip('LLM config check skipped (user_config table missing)');
            } else {
                try {
                    const res = await pool.query(
                        `SELECT config->>'llm_endpoint' AS endpoint FROM user_config LIMIT 1`
                    );
                    const endpoint = res.rows.length > 0 ? res.rows[0].endpoint : null;
                    if (endpoint) {
                        pass(`LLM configured: ${endpoint}`);
                    } else {
                        warn('LLM not configured — set llm_endpoint in Settings before generating documents');
                    }
                } catch (err) {
                    // Graceful skip if anything goes wrong
                    skip(`LLM config check skipped: ${err.message}`);
                }
            }
        }

        if (pool) {
            await pool.end().catch(() => {});
        }
    }

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    console.log(`\nSummary: ${passed}/${total} passed, ${failed} failed, ${warnings} warnings\n`);

    process.exit(failed > 0 ? 1 : 0);
})();
