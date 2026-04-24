/**
 * CAPTCHA Solver using NopeCHA + Stealth Techniques
 *
 * NopeCHA provides:
 * - 100 free requests per day (no API key needed)
 * - Supports reCAPTCHA v2/v3, hCaptcha, FunCaptcha, Cloudflare Turnstile
 * - Works with Playwright/Puppeteer
 *
 * Installation: npm install nopecha
 * No API key required for free tier!
 */

const NopeCHA = require('nopecha');

/**
 * Detect CAPTCHA type on page
 * @param {Object} page - Playwright page
 * @returns {Promise<string|null>} - 'recaptcha' | 'hcaptcha' | 'turnstile' | null
 */
async function detectCaptcha(page) {
    return await page.evaluate(() => {
        // Check for reCAPTCHA
        if (document.querySelector('.g-recaptcha') ||
            document.querySelector('iframe[src*="google.com/recaptcha"]') ||
            document.querySelector('script[src*="recaptcha"]')) {
            return 'recaptcha';
        }

        // Check for hCaptcha
        if (document.querySelector('.h-captcha') ||
            document.querySelector('iframe[src*="hcaptcha.com"]')) {
            return 'hcaptcha';
        }

        // Check for Cloudflare Turnstile
        if (document.querySelector('iframe[src*="challenges.cloudflare.com"]') ||
            document.querySelector('[data-sitekey*="cloudflare"]')) {
            return 'turnstile';
        }

        return null;
    });
}

/**
 * Solve CAPTCHA using stealth/evasion techniques
 * Avoids triggering CAPTCHAs by using undetectable browser fingerprints
 * @param {Object} page - Playwright page
 * @returns {Promise<boolean>} - True if CAPTCHA bypassed
 */
async function bypassCaptchaWithStealth(page) {
    // Inject stealth scripts to avoid CAPTCHA detection
    await page.addInitScript(() => {
        // Override navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });

        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });

        // Mock languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });

        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
    });

    return true;
}

/**
 * Solve CAPTCHA using NopeCHA (FREE - 100 requests/day)
 * @param {Object} page - Playwright page
 * @returns {Promise<boolean>} - True if solved, false otherwise
 */
async function solveWithNopeCHA(page) {
    try {
        const nopecha = new NopeCHA();

        // NopeCHA automatically detects and solves CAPTCHAs on the page
        await nopecha.solve(page);

        // Wait for solution to be applied
        await page.waitForTimeout(3000);

        // Check if CAPTCHA is gone
        const stillPresent = await detectCaptcha(page);
        return !stillPresent;
    } catch (err) {
        console.error(`NopeCHA solving failed: ${err.message}`);
        return false;
    }
}

/**
 * Multi-strategy CAPTCHA solver
 * 1. Stealth bypass (avoid triggering CAPTCHA)
 * 2. NopeCHA solver (100 free requests/day)
 *
 * @param {Object} page - Playwright page
 * @returns {Promise<boolean>} - True if solved/bypassed, false otherwise
 */
async function solveCaptchaIfPresent(page) {
    const captchaType = await detectCaptcha(page);

    if (!captchaType) {
        return false; // No CAPTCHA detected
    }

    console.error(`CAPTCHA detected: ${captchaType}`);

    // Strategy 1: Try stealth bypass first (fastest, no API calls)
    // addInitScript only applies to future navigations, so reload to trigger it
    await bypassCaptchaWithStealth(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const stillPresentAfterStealth = await detectCaptcha(page);
    if (!stillPresentAfterStealth) {
        console.error('CAPTCHA bypassed with stealth techniques');
        return true;
    }

    // Strategy 2: Try NopeCHA (100 free requests/day)
    console.error('Attempting NopeCHA solving...');
    const nopechaSolved = await solveWithNopeCHA(page);
    if (nopechaSolved) {
        console.error('CAPTCHA solved with NopeCHA');
        return true;
    }

    // All strategies failed - CAPTCHA still present
    console.error('CAPTCHA could not be solved automatically - marking for manual review');
    return false;
}

module.exports = {
    detectCaptcha,
    bypassCaptchaWithStealth,
    solveWithNopeCHA,
    solveCaptchaIfPresent
};
