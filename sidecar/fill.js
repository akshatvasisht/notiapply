#!/usr/bin/env node
/**
 * Notiapply Playwright Sidecar — fill.js
 *
 * Spawned by Tauri as a child process. Reads queued applications from Postgres,
 * opens headed Chromium with Simplify extension, uploads resume, triggers autofill,
 * inspects post-fill state, and reports results via stdout NDJSON.
 *
 * Usage: node fill.js --session-id <uuid> --chromium-path <path> --simplify-path <path>
 */

require('dotenv').config();
const { chromium } = require('playwright');
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');
const os = require('os');
const minimist = require('minimist');

const args = minimist(process.argv.slice(2), {
    string: ['session-id', 'chromium-path', 'simplify-path'],
});

const SESSION_ID = args['session-id'];
const CHROMIUM_PATH = args['chromium-path'];
const SIMPLIFY_PATH = args['simplify-path'];

if (!SESSION_ID || !CHROMIUM_PATH || !SIMPLIFY_PATH) {
    console.error('Usage: node fill.js --session-id <uuid> --chromium-path <path> --simplify-path <path>');
    process.exit(1);
}

function emit(event) {
    process.stdout.write(JSON.stringify(event) + '\n');
}

const ATS_PATTERNS = [
    { pattern: /workday\.com|myworkdayjobs\.com/, name: 'workday' },
    { pattern: /greenhouse\.io/, name: 'greenhouse' },
    { pattern: /lever\.co/, name: 'lever' },
    { pattern: /icims\.com/, name: 'icims' },
    { pattern: /taleo\.net/, name: 'taleo' },
    { pattern: /jobvite\.com/, name: 'jobvite' },
    { pattern: /ashbyhq\.com/, name: 'ashby' },
];

function detectAts(url) {
    for (const { pattern, name } of ATS_PATTERNS) {
        if (pattern.test(url)) return name;
    }
    return 'unknown';
}

/**
 * Preflight: verify that the required external binaries exist before touching the DB.
 * Emits a structured `preflight_failed` NDJSON event so the Tauri UI can surface
 * an actionable error message rather than a cryptic Playwright launch failure.
 *
 * Design note: We depend on Simplify (borrow vs. build). Simplify has already solved
 * ATS form detection and shadow-DOM field mapping — reimplementing that would be
 * expensive and fragile. The tradeoff is that the user must have it installed and
 * configured via Settings. This preflight makes that contract explicit at startup.
 */
function preflight() {
    const errors = [];

    if (!fs.existsSync(CHROMIUM_PATH)) {
        errors.push(`Chromium not found at: ${CHROMIUM_PATH}. Update the path in Settings → Automation.`);
    }

    if (!fs.existsSync(SIMPLIFY_PATH)) {
        errors.push(`Simplify extension not found at: ${SIMPLIFY_PATH}. Update the path in Settings → Automation.`);
    }

    if (errors.length > 0) {
        emit({ event: 'preflight_failed', errors });
        process.exit(2);
    }
}

async function main() {
    // Validate that Chromium + Simplify paths exist before touching the DB.
    // Emits preflight_failed and exits(2) if either is missing.
    preflight();

    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    // Fetch queued applications
    const { rows: applications } = await db.query(`
    SELECT a.id, a.resume_pdf, a.cover_letter_pdf, j.url, j.id AS job_id
    FROM applications a
    JOIN jobs j ON j.id = a.job_id
    WHERE j.state = 'queued'
    ORDER BY a.queued_at ASC
  `);

    if (applications.length === 0) {
        emit({ event: 'done', session_id: SESSION_ID, filled: 0, incomplete: 0, failed: 0 });
        await db.end();
        process.exit(0);
    }

    // Write PDFs to temp directory
    const tmpDir = path.join(os.tmpdir(), 'notiapply', SESSION_ID);
    fs.mkdirSync(tmpDir, { recursive: true });

    for (const app of applications) {
        const resumePath = path.join(tmpDir, `resume_${app.id}.pdf`);
        const coverPath = path.join(tmpDir, `cover_${app.id}.pdf`);
        if (app.resume_pdf) fs.writeFileSync(resumePath, app.resume_pdf);
        if (app.cover_letter_pdf) fs.writeFileSync(coverPath, app.cover_letter_pdf);
        app.local_resume_pdf_path = resumePath;
        app.local_cover_letter_pdf_path = coverPath;
    }

    // Launch Chromium with Simplify extension
    const browser = await chromium.launchPersistentContext(
        path.join(os.tmpdir(), 'notiapply-chrome-profile'),
        {
            headless: false,
            executablePath: CHROMIUM_PATH,
            args: [
                `--disable-extensions-except=${SIMPLIFY_PATH}`,
                `--load-extension=${SIMPLIFY_PATH}`,
            ],
        }
    );

    let filled = 0;
    let incomplete = 0;
    let failed = 0;

    for (const app of applications) {
        try {
            // Atomic state claim
            const claimResult = await db.query(
                "UPDATE jobs SET state = 'filling' WHERE id = $1 AND state = 'queued' RETURNING id",
                [app.job_id]
            );

            if (claimResult.rows.length === 0) continue; // Another process claimed this job

            await db.query(
                'UPDATE applications SET fill_started_at = NOW() WHERE id = $1',
                [app.id]
            );

            const page = await browser.newPage();
            await page.goto(app.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            const ats = detectAts(app.url);
            await db.query('UPDATE applications SET ats_platform = $1 WHERE id = $2', [ats, app.id]);

            // Resume upload — Strategy A: static file input
            let uploaded = false;
            try {
                const fileInput = page.locator('input[type="file"]').first();
                await fileInput.waitFor({ state: 'attached', timeout: 3000 });
                await fileInput.setInputFiles(app.local_resume_pdf_path);
                uploaded = true;
            } catch {
                // Strategy B: dynamic file chooser (Workday, iCIMS)
                try {
                    const [chooser] = await Promise.all([
                        page.waitForEvent('filechooser', { timeout: 5000 }),
                        page.click('[data-automation-id="fileUpload"], [aria-label*="upload"], [aria-label*="Upload"]'),
                    ]);
                    await chooser.setFiles(app.local_resume_pdf_path);
                    uploaded = true;
                } catch {
                    // Could not upload — continue anyway, Simplify may still work
                }
            }

            // Wait for Simplify overlay
            try {
                await page.waitForSelector('[data-simplify-loaded="true"]', { timeout: 10000 });
            } catch {
                await db.query("UPDATE jobs SET state = 'fill-failed' WHERE id = $1", [app.job_id]);
                await db.query(
                    "UPDATE applications SET fill_error_ats = $1, fill_notes = $2, fill_completed_at = NOW() WHERE id = $3",
                    [ats, 'Simplify overlay timeout', app.id]
                );
                emit({ event: 'failed', application_id: app.id, ats, reason: 'Simplify overlay timeout' });
                failed++;
                await page.close();
                continue;
            }

            // Trigger Simplify autofill and wait for completion
            try {
                await page.waitForSelector('[data-simplify-filling="false"]', { timeout: 30000 });
            } catch {
                // Timeout waiting for fill — treat as incomplete
            }

            // Post-fill inspection
            const emptyRequired = await page.evaluate(() =>
                Array.from(document.querySelectorAll(
                    'input[required], select[required], textarea[required]'
                ))
                    .filter(el => !el.value?.trim())
                    .map(el => {
                        const label = document.querySelector(`label[for="${el.id}"]`);
                        return label?.innerText.trim() || el.name || el.placeholder || 'Unknown field';
                    })
            );

            if (emptyRequired.length > 0) {
                await db.query("UPDATE jobs SET state = 'review-incomplete' WHERE id = $1", [app.job_id]);
                await db.query(
                    "UPDATE applications SET incomplete_fields = $1, fill_completed_at = NOW() WHERE id = $2",
                    [JSON.stringify(emptyRequired), app.id]
                );
                emit({ event: 'incomplete', application_id: app.id, ats, missing_fields: emptyRequired });
                incomplete++;
            } else {
                await db.query("UPDATE jobs SET state = 'review-ready' WHERE id = $1", [app.job_id]);
                await db.query('UPDATE applications SET fill_completed_at = NOW() WHERE id = $1', [app.id]);
                emit({ event: 'progress', application_id: app.id, state: 'review-ready', ats });
                filled++;
            }

            await page.close();
        } catch (err) {
            const ats = detectAts(app.url);
            await db.query("UPDATE jobs SET state = 'fill-failed' WHERE id = $1", [app.job_id]);
            await db.query(
                "UPDATE applications SET fill_error_ats = $1, fill_notes = $2, fill_completed_at = NOW() WHERE id = $3",
                [ats, `${err.message}\n${err.stack}`, app.id]
            );
            emit({ event: 'failed', application_id: app.id, ats, reason: err.message });
            failed++;
        }
    }

    // Update fill_sessions
    await db.query(`
    UPDATE fill_sessions
    SET completed_at = NOW(),
        jobs_attempted = $1,
        jobs_filled = $2,
        jobs_incomplete = $3,
        jobs_failed = $4
    WHERE session_uuid = $5::uuid
  `, [filled + incomplete + failed, filled, incomplete, failed, SESSION_ID]);

    emit({ event: 'done', session_id: SESSION_ID, filled, incomplete, failed });

    await browser.close();

    // Cleanup temp files
    try {
        fs.rmSync(tmpDir, { recursive: true });
    } catch { /* best effort */ }

    await db.end();
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
