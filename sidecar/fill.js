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


const { chromium } = require('playwright-extra'); // Stealth-enabled Playwright
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');
const os = require('os');
const minimist = require('minimist');
const { createBrowserAgent } = require('./browser-agent');
const { createEmailChecker } = require('./email-verification');
const { solveCaptchaIfPresent } = require('./captcha-solver');

// Apply stealth plugin to bypass bot detection
chromium.use(StealthPlugin());

const args = minimist(process.argv.slice(2), {
    string: ['session-id', 'chromium-path', 'simplify-path', 'db-url'],
});

const SESSION_ID = args['session-id'];
const CHROMIUM_PATH = args['chromium-path'];
const SIMPLIFY_PATH = args['simplify-path'];
const DB_URL = args['db-url'];

if (!SESSION_ID || !CHROMIUM_PATH || !SIMPLIFY_PATH || !DB_URL) {
    console.error('Usage: node fill.js --session-id <uuid> --chromium-path <path> --simplify-path <path> --db-url <url>');
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

    const db = new Client({ connectionString: DB_URL });
    await db.connect();

    // Load browser agent config from database
    let browserAgent = null;
    let userConfig = null;
    try {
        const { rows } = await db.query('SELECT * FROM user_config LIMIT 1');
        userConfig = rows[0];

        if (userConfig?.browser_agent_enabled && userConfig?.llm_endpoint) {
            browserAgent = await createBrowserAgent(userConfig);
            emit({ event: 'info', message: `Browser agent enabled with ${userConfig.llm_provider || 'openai'}` });
        }
    } catch (error) {
        emit({ event: 'warning', message: `Failed to load browser agent config: ${error.message}` });
    }

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

            // Network retry with exponential backoff
            let navigationSuccess = false;
            let attempt = 0;
            const maxAttempts = 3;

            while (!navigationSuccess && attempt < maxAttempts) {
                try {
                    attempt++;
                    await page.goto(app.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    navigationSuccess = true;
                } catch (navError) {
                    if (attempt < maxAttempts) {
                        const backoffMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
                        await new Promise(resolve => setTimeout(resolve, backoffMs));
                    } else {
                        throw new Error(`Navigation failed after ${maxAttempts} attempts: ${navError.message}`);
                    }
                }
            }

            const ats = detectAts(app.url);
            await db.query('UPDATE applications SET ats_platform = $1 WHERE id = $2', [ats, app.id]);

            // Session validation - check if user is logged in
            const isLoggedIn = await page.evaluate(() => {
                // Check for common logged-out indicators across ATS platforms
                const loggedOutPatterns = [
                    /sign\s*in/i, /log\s*in/i, /login/i,
                    /create\s*account/i, /register/i,
                    /enter\s*your\s*email/i, /enter\s*your\s*password/i
                ];

                // Check button text and link text
                const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                const hasLoginButton = buttons.some(btn => {
                    const text = btn.textContent?.trim() || '';
                    return loggedOutPatterns.some(pattern => pattern.test(text));
                });

                // Check for login forms (email + password fields together)
                const emailInput = document.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i]');
                const passwordInput = document.querySelector('input[type="password"]');
                const hasLoginForm = emailInput && passwordInput;

                return !(hasLoginButton || hasLoginForm);
            });

            if (!isLoggedIn) {
                const domain = new URL(app.url).hostname;

                // Check if this is a signup/registration page
                const needsAccountCreation = await page.evaluate(() => {
                    const signupPatterns = [
                        /create\s*account/i, /sign\s*up/i, /register/i,
                        /new\s*user/i, /join\s*now/i, /get\s*started/i
                    ];
                    const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                    const hasSignupButton = buttons.some(btn => {
                        const text = btn.textContent?.trim() || '';
                        return signupPatterns.some(pattern => pattern.test(text));
                    });

                    // Check page title/heading for signup indicators
                    const title = document.title.toLowerCase();
                    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
                        .map(h => h.textContent?.toLowerCase() || '');
                    const hasSignupHeading = [...headings, title].some(text =>
                        signupPatterns.some(pattern => pattern.test(text))
                    );

                    return hasSignupButton || hasSignupHeading;
                });

                // Handle account creation if needed
                if (needsAccountCreation && browserAgent && userConfig.browser_agent_auto_login && userConfig.user_email) {
                    try {
                        emit({ event: 'info', message: `No account found on ${domain}. Creating account using browser agent...` });

                        const userData = {
                            email: userConfig.user_email,
                            password: userConfig.ats_password,
                            firstName: userConfig.user_first_name,
                            lastName: userConfig.user_last_name,
                            phone: userConfig.user_phone
                        };

                        const accountCreationStartTime = Date.now();
                        await browserAgent.createAccount(page, userData);

                        // Wait for account creation to complete
                        await page.waitForTimeout(3000);

                        // Solve CAPTCHA if present (FREE - no API key needed!)
                        try {
                            const captchaSolved = await solveCaptchaIfPresent(page);
                            if (captchaSolved) {
                                emit({ event: 'success', message: `CAPTCHA bypassed/solved automatically on ${domain}` });
                                await page.waitForTimeout(2000);
                            }
                        } catch (captchaError) {
                            emit({ event: 'info', message: `CAPTCHA detection: ${captchaError.message}` });
                            // Not a failure - will continue and may mark for manual review if CAPTCHA blocks progress
                        }

                        // Check if email verification is required
                        const needsEmailVerification = await page.evaluate(() => {
                            const verifyPatterns = /check\s*your\s*email|verify\s*your\s*email|confirm\s*your\s*email|verification\s*email/i;
                            const pageText = document.body.innerText;
                            return verifyPatterns.test(pageText);
                        });

                        if (needsEmailVerification) {
                            emit({ event: 'info', message: `Email verification required for ${domain}. Monitoring inbox...` });

                            try {
                                // Create email checker for this domain
                                const emailTimeout = userConfig.email_verification_timeout || 120000; // Default 2 minutes
                                const checkEmail = createEmailChecker(domain, accountCreationStartTime, userConfig);

                                // Wait for verification email and click link
                                await browserAgent.waitForEmailVerification(
                                    page,
                                    userConfig.user_email,
                                    checkEmail,
                                    emailTimeout
                                );

                                emit({ event: 'success', message: `Email verified successfully for ${domain}` });
                                await page.waitForTimeout(2000);
                            } catch (emailError) {
                                // Email verification failed - mark for manual review
                                emit({ event: 'warning', message: `Email verification timeout for ${domain}. Please verify manually.` });

                                await db.query("UPDATE jobs SET state = 'review-incomplete' WHERE id = $1", [app.job_id]);
                                await db.query(
                                    "UPDATE applications SET fill_error_ats = $1, fill_notes = $2, fill_completed_at = NOW() WHERE id = $3",
                                    [ats, `Account created but email verification pending. Check ${userConfig.user_email} and click verification link.`, app.id]
                                );
                                incomplete++;
                                await page.close();
                                continue;
                            }
                        }

                        // Verify account creation succeeded (should redirect to logged-in state or login page)
                        const accountCreated = await page.evaluate(() => {
                            const signupPatterns = /create\s*account|sign\s*up|register/i;
                            const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                            const stillOnSignup = buttons.some(btn => signupPatterns.test(btn.textContent?.trim() || ''));
                            return !stillOnSignup;
                        });

                        if (accountCreated) {
                            emit({ event: 'success', message: `Account created successfully on ${domain}` });

                            // After account creation, may need to log in
                            const nowLoggedIn = await page.evaluate(() => {
                                const loggedOutPatterns = /sign\s*in|log\s*in|login/i;
                                const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                                return !buttons.some(btn => loggedOutPatterns.test(btn.textContent?.trim() || ''));
                            });

                            if (!nowLoggedIn) {
                                emit({ event: 'info', message: `Logging in to newly created account on ${domain}...` });
                                await browserAgent.login(page, userConfig.user_email, userConfig.ats_password);
                                await page.waitForTimeout(2000);
                            }
                        } else {
                            throw new Error('Account creation verification failed - still on signup page');
                        }
                    } catch (signupError) {
                        emit({
                            event: 'warning',
                            message: `Account creation failed for ${domain}: ${signupError.message}. Marking for manual review.`
                        });

                        await db.query("UPDATE jobs SET state = 'review-incomplete' WHERE id = $1", [app.job_id]);
                        await db.query(
                            "UPDATE applications SET fill_error_ats = $1, fill_notes = $2, fill_completed_at = NOW() WHERE id = $3",
                            [ats, `Account creation failed for ${domain}. Please create account manually.`, app.id]
                        );
                        incomplete++;
                        await page.close();
                        continue;
                    }
                } else if (browserAgent && userConfig.browser_agent_auto_login && userConfig.user_email) {
                    // Attempt auto-login if browser agent is configured
                    try {
                        emit({ event: 'info', message: `Attempting auto-login for ${domain} using browser agent...` });

                        await browserAgent.login(
                            page,
                            userConfig.user_email,
                            userConfig.ats_password
                        );

                        // Verify login succeeded
                        await page.waitForTimeout(2000); // Wait for redirect/page load
                        const nowLoggedIn = await page.evaluate(() => {
                            const loggedOutPatterns = [
                                /sign\s*in/i, /log\s*in/i, /login/i,
                                /enter\s*your\s*email/i, /enter\s*your\s*password/i
                            ];
                            const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                            const hasLoginButton = buttons.some(btn => {
                                const text = btn.textContent?.trim() || '';
                                return loggedOutPatterns.some(pattern => pattern.test(text));
                            });
                            return !hasLoginButton;
                        });

                        if (nowLoggedIn) {
                            emit({ event: 'success', message: `Auto-login successful for ${domain}` });
                            // Continue with application - don't skip to next iteration
                        } else {
                            throw new Error('Login verification failed - still seeing login page');
                        }
                    } catch (loginError) {
                        emit({
                            event: 'warning',
                            message: `Auto-login failed for ${domain}: ${loginError.message}. Marking for manual review.`
                        });

                        await db.query("UPDATE jobs SET state = 'review-incomplete' WHERE id = $1", [app.job_id]);
                        await db.query(
                            "UPDATE applications SET fill_error_ats = $1, fill_notes = $2, fill_completed_at = NOW() WHERE id = $3",
                            [ats, `Auto-login failed for ${domain}. Please log in manually.`, app.id]
                        );
                        incomplete++;
                        await page.close();
                        continue;
                    }
                } else {
                    // No browser agent or auto-login disabled - require manual login
                    await db.query("UPDATE jobs SET state = 'review-incomplete' WHERE id = $1", [app.job_id]);
                    await db.query(
                        "UPDATE applications SET fill_error_ats = $1, fill_notes = $2, fill_completed_at = NOW() WHERE id = $3",
                        [ats, `Not logged in to ${domain}. Please log in manually using the persistent browser session.`, app.id]
                    );
                    emit({
                        event: 'error',
                        message: `Session expired for ${domain}. Please log in manually and retry.`,
                        application_id: app.id,
                        ats
                    });
                    incomplete++;
                    await page.close();
                    continue;
                }
            }

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
                // Simplify timeout → mark as manual-review instead of failed
                await db.query("UPDATE jobs SET state = 'review-incomplete' WHERE id = $1", [app.job_id]);
                await db.query(
                    "UPDATE applications SET fill_error_ats = $1, fill_notes = $2, fill_completed_at = NOW() WHERE id = $3",
                    [ats, 'Simplify extension did not load. Manual review required.', app.id]
                );
                emit({ event: 'incomplete', application_id: app.id, ats, missing_fields: ['Simplify not loaded'] });
                incomplete++;
                await page.close();
                continue;
            }

            // Click Simplify autofill button to trigger filling
            let autofillTriggered = false;
            try {
                // Strategy 1: Look for Simplify's autofill button by common selectors
                const simplifyButton = await page.waitForSelector(
                    'button:has-text("Autofill"), [aria-label*="Autofill"], [data-testid*="autofill"], button[class*="simplify"]',
                    { timeout: 3000 }
                ).catch(() => null);

                if (simplifyButton) {
                    await simplifyButton.click();
                    autofillTriggered = true;
                } else {
                    // Strategy 2: Search for any button with "autofill" text (case-insensitive)
                    autofillTriggered = await page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
                        const autofillBtn = buttons.find(btn =>
                            btn.textContent?.toLowerCase().includes('autofill') ||
                            btn.getAttribute('aria-label')?.toLowerCase().includes('autofill')
                        );
                        if (autofillBtn) {
                            autofillBtn.click();
                            return true;
                        }
                        return false;
                    });
                }

                if (!autofillTriggered) {
                    // Strategy 3: Try clicking Simplify extension popup/icon if visible
                    const extensionIcon = await page.locator('[class*="simplify"], [id*="simplify"]').first();
                    if (await extensionIcon.isVisible().catch(() => false)) {
                        await extensionIcon.click();
                        autofillTriggered = true;
                    }
                }
            } catch (e) {
                emit({ event: 'warning', message: `Could not click Simplify button: ${e.message}` });
            }

            // Wait for Simplify autofill to complete
            try {
                await page.waitForSelector('[data-simplify-filling="false"]', { timeout: 30000 });
            } catch {
                // Timeout waiting for fill — treat as incomplete
                if (!autofillTriggered) {
                    emit({ event: 'warning', message: 'Simplify autofill button not found - may need manual trigger' });
                }
            }

            // Post-fill inspection
            let emptyRequired = await page.evaluate(() =>
                Array.from(document.querySelectorAll(
                    'input[required], select[required], textarea[required]'
                ))
                    .filter(el => !el.value?.trim())
                    .map(el => {
                        const label = document.querySelector(`label[for="${el.id}"]`);
                        return label?.innerText.trim() || el.name || el.placeholder || 'Unknown field';
                    })
            );

            // Track resume upload status
            let allMissingFields = uploaded ? emptyRequired : ['Resume not uploaded', ...emptyRequired];

            // Fallback to browser agent if Simplify left required fields empty
            if (allMissingFields.length > 0 && browserAgent && userConfig.browser_agent_fallback) {
                try {
                    emit({ event: 'info', message: `Simplify left ${allMissingFields.length} fields empty. Attempting browser agent fallback...` });

                    // Prepare application data from user config
                    const applicationData = {
                        firstName: userConfig.user_first_name,
                        lastName: userConfig.user_last_name,
                        email: userConfig.user_email,
                        phone: userConfig.user_phone,
                        resumePath: app.local_resume_pdf_path
                    };

                    await browserAgent.fillApplication(page, applicationData);

                    // Re-check for empty required fields
                    emptyRequired = await page.evaluate(() =>
                        Array.from(document.querySelectorAll(
                            'input[required], select[required], textarea[required]'
                        ))
                            .filter(el => !el.value?.trim())
                            .map(el => {
                                const label = document.querySelector(`label[for="${el.id}"]`);
                                return label?.innerText.trim() || el.name || el.placeholder || 'Unknown field';
                            })
                    );

                    allMissingFields = uploaded ? emptyRequired : ['Resume not uploaded', ...emptyRequired];

                    if (allMissingFields.length === 0) {
                        emit({ event: 'success', message: 'Browser agent successfully filled remaining fields' });
                    } else {
                        emit({ event: 'warning', message: `Browser agent reduced missing fields to ${allMissingFields.length}` });
                    }
                } catch (agentError) {
                    emit({ event: 'warning', message: `Browser agent fallback failed: ${agentError.message}` });
                }
            }

            if (allMissingFields.length > 0) {
                await db.query("UPDATE jobs SET state = 'review-incomplete' WHERE id = $1", [app.job_id]);
                await db.query(
                    "UPDATE applications SET incomplete_fields = $1, fill_completed_at = NOW() WHERE id = $2",
                    [JSON.stringify(allMissingFields), app.id]
                );
                emit({ event: 'incomplete', application_id: app.id, ats, missing_fields: allMissingFields });
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
