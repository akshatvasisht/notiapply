/**
 * IMAP Email Verification
 *
 * Universal email verification for non-Gmail users.
 * Supports any IMAP-compatible email provider (Outlook, Yahoo, ProtonMail, etc.)
 *
 * Uses imapflow - modern IMAP client for Node.js
 */

const { ImapFlow } = require('imapflow');

/**
 * Extract verification link from email body
 * @param {string} emailBody - Email text/HTML content
 * @param {string} fromDomain - Expected domain in link
 * @returns {string|null} - Verification link or null
 */
function extractVerificationLink(emailBody, fromDomain) {
    // Common verification URL patterns
    const patterns = [
        new RegExp(`https?://[^\\s<>"]+${fromDomain}[^\\s<>"]*/(verify|confirm|activate)[^\\s<>"]*`, 'i'),
        new RegExp(`https?://[^\\s<>"]+${fromDomain}[^\\s<>"]*\\?[^"\\s]*(?:token|verification|confirm)[^\\s<>"]*`, 'i'),
        new RegExp(`https?://[^\\s<>"]+${fromDomain}[^\\s<>"]*/[a-zA-Z0-9_-]{20,}`, 'i'),
    ];

    for (const pattern of patterns) {
        const match = emailBody.match(pattern);
        if (match) {
            return match[0];
        }
    }

    return null;
}

/**
 * Check IMAP inbox for verification email
 * @param {Object} config - IMAP configuration
 * @param {string} config.host - IMAP host (e.g., 'imap.gmail.com')
 * @param {number} config.port - IMAP port (993 for SSL, 143 for STARTTLS)
 * @param {boolean} config.secure - Use TLS (true for port 993)
 * @param {string} config.user - Email address
 * @param {string} config.password - Email password or app-specific password
 * @param {string} fromDomain - Domain to filter emails from
 * @param {number} sinceTimestamp - Only check emails after this timestamp (ms)
 * @returns {Promise<string|null>} - Verification link or null
 */
async function checkImapVerificationEmail(config, fromDomain, sinceTimestamp) {
    const client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.password
        },
        logger: false // Disable logging for production
    });

    try {
        // Connect to IMAP server
        await client.connect();

        // Select INBOX
        await client.mailboxOpen('INBOX');

        // Convert timestamp to Date
        const sinceDate = new Date(sinceTimestamp);

        // Search for emails from domain since timestamp
        const searchCriteria = {
            from: fromDomain,
            since: sinceDate
        };

        // Get message UIDs
        const messages = [];
        for await (const msg of client.fetch(searchCriteria, { envelope: true, bodyStructure: true })) {
            messages.push(msg);
        }

        // Sort by most recent first
        messages.sort((a, b) => b.envelope.date - a.envelope.date);

        // Check recent emails for verification link
        for (const msg of messages.slice(0, 5)) { // Check last 5 emails
            // Check subject for verification keywords
            const subject = msg.envelope.subject.toLowerCase();
            const hasVerificationKeyword = /verify|confirm|activate|registration/i.test(subject);

            if (hasVerificationKeyword) {
                // Fetch email body
                const bodyPart = msg.bodyStructure.childNodes?.find(node => node.type === 'text/html') ||
                                 msg.bodyStructure.childNodes?.find(node => node.type === 'text/plain') ||
                                 msg.bodyStructure;

                if (bodyPart) {
                    const { content } = await client.download(msg.uid, bodyPart.part || '1');
                    const emailBody = content.toString();

                    // Extract verification link
                    const verificationLink = extractVerificationLink(emailBody, fromDomain);
                    if (verificationLink) {
                        await client.logout();
                        return verificationLink;
                    }
                }
            }
        }

        await client.logout();
        return null;

    } catch (error) {
        try {
            await client.logout();
        } catch (e) {
            // Ignore logout errors
        }
        throw error;
    }
}

/**
 * Auto-detect IMAP settings for common providers
 * @param {string} email - Email address
 * @returns {Object|null} - IMAP config or null if unknown
 */
function getImapConfig(email) {
    const domain = email.split('@')[1]?.toLowerCase();

    const providerConfigs = {
        // Gmail
        'gmail.com': { host: 'imap.gmail.com', port: 993, secure: true },
        'googlemail.com': { host: 'imap.gmail.com', port: 993, secure: true },

        // Outlook/Hotmail/Live
        'outlook.com': { host: 'outlook.office365.com', port: 993, secure: true },
        'hotmail.com': { host: 'outlook.office365.com', port: 993, secure: true },
        'live.com': { host: 'outlook.office365.com', port: 993, secure: true },

        // Yahoo
        'yahoo.com': { host: 'imap.mail.yahoo.com', port: 993, secure: true },

        // iCloud
        'icloud.com': { host: 'imap.mail.me.com', port: 993, secure: true },
        'me.com': { host: 'imap.mail.me.com', port: 993, secure: true },

        // ProtonMail
        'protonmail.com': { host: 'bridge.protonmail.ch', port: 1143, secure: false },
        'proton.me': { host: 'bridge.protonmail.ch', port: 1143, secure: false },

        // AOL
        'aol.com': { host: 'imap.aol.com', port: 993, secure: true },

        // Zoho
        'zoho.com': { host: 'imap.zoho.com', port: 993, secure: true }
    };

    return providerConfigs[domain] || null;
}

module.exports = {
    checkImapVerificationEmail,
    extractVerificationLink,
    getImapConfig
};
