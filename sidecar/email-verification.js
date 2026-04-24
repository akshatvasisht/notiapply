/**
 * Email Verification Helper
 *
 * Universal email verification supporting both Gmail API and IMAP.
 * - Gmail users: Uses Gmail API (faster, more reliable)
 * - Other providers: Uses IMAP (Outlook, Yahoo, iCloud, ProtonMail, etc.)
 */

const { spawn } = require('child_process');
const path = require('path');
const { checkImapVerificationEmail, getImapConfig } = require('./imap-verification');

/**
 * Check Gmail API for verification email from specific domain
 * @param {string} email - User's email address (must match Gmail account)
 * @param {string} fromDomain - Domain to filter emails from (e.g., 'greenhouse.io', 'workday.com')
 * @param {number} sinceTimestamp - Only check emails after this timestamp (ms)
 * @returns {Promise<string|null>} - Verification link or null if not found
 */
async function checkGmailApi(email, fromDomain, sinceTimestamp) {
    return new Promise((resolve, reject) => {
        const pythonScript = path.join(__dirname, '..', 'server', 'check_verification_email.py');

        const python = spawn('python3', [
            pythonScript,
            '--email', email,
            '--from-domain', fromDomain,
            '--since', sinceTimestamp.toString()
        ]);

        let stdout = '';
        let stderr = '';

        python.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        python.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        python.on('error', (err) => {
            reject(new Error(`Failed to spawn python3 for email check: ${err.message}`));
        });

        python.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout.trim());
                    resolve(result.verification_link || null);
                } catch (err) {
                    // No verification link found
                    resolve(null);
                }
            } else {
                // Gmail API not configured - gracefully degrade
                if (stderr.includes('credentials not found')) {
                    resolve(null);
                } else {
                    reject(new Error(`Email check failed: ${stderr}`));
                }
            }
        });
    });
}

/**
 * Universal email verification (tries Gmail API first, falls back to IMAP)
 * @param {string} email - User's email address
 * @param {string} fromDomain - Domain to filter emails from
 * @param {number} sinceTimestamp - Only check emails after this timestamp (ms)
 * @param {Object} userConfig - User configuration from database
 * @returns {Promise<string|null>} - Verification link or null
 */
async function checkVerificationEmail(email, fromDomain, sinceTimestamp, userConfig) {
    const emailDomain = email.split('@')[1]?.toLowerCase();

    // Try Gmail API first (if Gmail user)
    if (emailDomain === 'gmail.com' || emailDomain === 'googlemail.com') {
        try {
            const link = await checkGmailApi(email, fromDomain, sinceTimestamp);
            if (link) return link;
        } catch (err) {
            // Gmail API failed, fall through to IMAP
            console.error(`Gmail API check failed, trying IMAP: ${err.message}`);
        }
    }

    // Use IMAP for non-Gmail or as fallback
    if (userConfig.email_imap_host || userConfig.user_email_password) {
        // Manual IMAP config provided
        const imapConfig = {
            host: userConfig.email_imap_host,
            port: userConfig.email_imap_port || 993,
            secure: userConfig.email_imap_secure !== false,
            user: email,
            password: userConfig.user_email_password
        };

        try {
            return await checkImapVerificationEmail(imapConfig, fromDomain, sinceTimestamp);
        } catch (err) {
            console.error(`IMAP check failed: ${err.message}`);
            return null;
        }
    }

    // Auto-detect IMAP settings
    const autoConfig = getImapConfig(email);
    if (autoConfig && userConfig.user_email_password) {
        const imapConfig = {
            ...autoConfig,
            user: email,
            password: userConfig.user_email_password
        };

        try {
            return await checkImapVerificationEmail(imapConfig, fromDomain, sinceTimestamp);
        } catch (err) {
            console.error(`IMAP auto-config failed: ${err.message}`);
            return null;
        }
    }

    // No email verification configured
    return null;
}

/**
 * Create email checker function for specific domain
 * @param {string} domain - Domain to monitor (e.g., 'greenhouse.io')
 * @param {number} sinceTimestamp - Timestamp when account creation started
 * @param {Object} userConfig - User configuration from database
 * @returns {Function} - Async function that returns verification link or null
 */
function createEmailChecker(domain, sinceTimestamp, userConfig) {
    return async (email) => {
        try {
            return await checkVerificationEmail(email, domain, sinceTimestamp, userConfig);
        } catch (err) {
            console.error(`Email verification check failed: ${err.message}`);
            return null;
        }
    };
}

module.exports = {
    checkGmailApi,
    checkVerificationEmail,
    createEmailChecker
};
