/**
 * field-filler.js — Resume upload + Simplify autofill + browser-agent fallback
 *
 * Extracted from fill.js.  Handles everything that happens once the browser
 * has landed on an ATS page and the user is confirmed logged-in:
 *   1. Resume upload (static file-input first, dynamic file-chooser fallback)
 *   2. Wait for Simplify overlay
 *   3. Click Simplify autofill button (3 strategies)
 *   4. Wait for fill to complete
 *   5. Post-fill inspection of empty required fields
 *   6. Browser-agent fallback if required fields remain empty
 *
 * Returns { allMissingFields, uploaded } so fill.js can decide which DB
 * state to write ('review-ready' vs 'review-incomplete').
 */

/**
 * @param {import('playwright').Page} page
 * @param {object} app           – single row from the applications query, with
 *                                 local_resume_pdf_path attached
 * @param {object|null} browserAgent  – created by createBrowserAgent(), or null
 * @param {object|null} userConfig    – row from user_config, or null
 * @param {object} db            – pg.Client instance
 * @param {string} ats           – detected ATS name (e.g. 'greenhouse')
 * @param {function} emit        – NDJSON emitter from fill.js
 * @returns {Promise<{ allMissingFields: string[], uploaded: boolean }>}
 */
async function fillApplication(page, app, browserAgent, userConfig, db, ats, emit) {
    // ── Resume upload ────────────────────────────────────────────────────────
    // Strategy A: static file input
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

    // ── Wait for Simplify overlay ─────────────────────────────────────────────
    try {
        await page.waitForSelector('[data-simplify-loaded="true"]', { timeout: 10000 });
    } catch {
        // Simplify timeout → caller marks as manual-review instead of failed
        await db.query("UPDATE jobs SET state = 'review-incomplete' WHERE id = $1", [app.job_id]);
        await db.query(
            "UPDATE applications SET fill_error_ats = $1, fill_notes = $2, fill_completed_at = NOW() WHERE id = $3",
            [ats, 'Simplify extension did not load. Manual review required.', app.id]
        );
        emit({ event: 'incomplete', application_id: app.id, ats, missing_fields: ['Simplify not loaded'] });
        // Signal to caller that we already updated DB and the loop should continue
        return { allMissingFields: null, uploaded, simplifyMissing: true };
    }

    // ── Click Simplify autofill button ───────────────────────────────────────
    let autofillTriggered = false;
    try {
        // Strategy 1: common selectors
        const simplifyButton = await page.waitForSelector(
            'button:has-text("Autofill"), [aria-label*="Autofill"], [data-testid*="autofill"], button[class*="simplify"]',
            { timeout: 3000 }
        ).catch(() => null);

        if (simplifyButton) {
            await simplifyButton.click();
            autofillTriggered = true;
        } else {
            // Strategy 2: case-insensitive text search via evaluate
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
            // Strategy 3: Simplify extension popup/icon
            const extensionIcon = await page.locator('[class*="simplify"], [id*="simplify"]').first();
            if (await extensionIcon.isVisible().catch(() => false)) {
                await extensionIcon.click();
                autofillTriggered = true;
            }
        }
    } catch (e) {
        emit({ event: 'warning', message: `Could not click Simplify button: ${e.message}` });
    }

    // ── Wait for fill completion ──────────────────────────────────────────────
    try {
        await page.waitForSelector('[data-simplify-filling="false"]', { timeout: 30000 });
    } catch {
        if (!autofillTriggered) {
            emit({ event: 'warning', message: 'Simplify autofill button not found - may need manual trigger' });
        }
    }

    // ── Post-fill inspection ──────────────────────────────────────────────────
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

    let allMissingFields = uploaded ? emptyRequired : ['Resume not uploaded', ...emptyRequired];

    // ── Browser-agent fallback ────────────────────────────────────────────────
    if (allMissingFields.length > 0 && browserAgent && userConfig && userConfig.browser_agent_fallback) {
        try {
            emit({ event: 'info', message: `Simplify left ${allMissingFields.length} fields empty. Attempting browser agent fallback...` });

            const applicationData = {
                firstName: userConfig.user_first_name,
                lastName: userConfig.user_last_name,
                email: userConfig.user_email,
                phone: userConfig.user_phone,
                resumePath: app.local_resume_pdf_path,
            };

            await browserAgent.fillApplication(page, applicationData);

            // Re-check
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

    return { allMissingFields, uploaded };
}

module.exports = { fillApplication };
