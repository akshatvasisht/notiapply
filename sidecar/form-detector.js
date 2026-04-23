/**
 * form-detector.js — ATS platform detection
 *
 * Provides a lookup table of URL patterns and a helper that identifies which
 * ATS a job-application URL belongs to.  Extracted from fill.js so the same
 * detection logic can be reused without pulling in Playwright / pg / etc.
 */

const ATS_PATTERNS = [
    { pattern: /workday\.com|myworkdayjobs\.com/, name: 'workday' },
    { pattern: /greenhouse\.io/, name: 'greenhouse' },
    { pattern: /lever\.co/, name: 'lever' },
    { pattern: /icims\.com/, name: 'icims' },
    { pattern: /taleo\.net/, name: 'taleo' },
    { pattern: /jobvite\.com/, name: 'jobvite' },
    { pattern: /ashbyhq\.com/, name: 'ashby' },
];

/**
 * Returns the lowercase ATS platform name for the given URL, or 'unknown'.
 * @param {string} url
 * @returns {string}
 */
function detectAts(url) {
    for (const { pattern, name } of ATS_PATTERNS) {
        if (pattern.test(url)) return name;
    }
    return 'unknown';
}

module.exports = { ATS_PATTERNS, detectAts };
