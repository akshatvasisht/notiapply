/**
 * SMTP email service for cold outreach.
 * Uses nodemailer with a module-level transport cache.
 * Designed for single-user desktop use — not a bulk email SaaS.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import dns from 'dns/promises';
import type { UserConfig } from './types';

let _transporter: Transporter | null = null;
let _transporterHost: string | undefined;

function getTransporter(config: UserConfig): Transporter {
    // Recreate if host changed
    if (_transporter && _transporterHost === config.smtp_host) {
        return _transporter;
    }
    clearTransportCache();

    _transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: config.smtp_port ?? (config.smtp_secure ? 465 : 587),
        secure: config.smtp_secure ?? false,
        auth: {
            user: config.smtp_user,
            pass: config.smtp_password,
        },
        pool: true,
        maxConnections: 1,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
    });
    _transporterHost = config.smtp_host;
    return _transporter;
}

export function clearTransportCache(): void {
    if (_transporter) {
        _transporter.close();
        _transporter = null;
        _transporterHost = undefined;
    }
}

export function buildEmailFooter(config: UserConfig): string {
    const lines: string[] = ['', '---'];
    if (config.physical_address) {
        lines.push(config.physical_address);
    }
    lines.push('To opt out of future emails, reply with "unsubscribe" in the subject line.');
    return lines.join('\n');
}

export interface SendResult {
    accepted: boolean;
    response: string;
    messageId?: string;
}

export async function sendEmail(
    to: string,
    subject: string,
    body: string,
    config: UserConfig
): Promise<SendResult> {
    const transporter = getTransporter(config);
    const footer = buildEmailFooter(config);
    const fullBody = `${body}${footer}`;

    const fromEmail = config.smtp_from_email ?? config.smtp_user ?? '';
    const from = config.smtp_from_name
        ? `"${config.smtp_from_name}" <${fromEmail}>`
        : fromEmail;

    const info = await transporter.sendMail({
        from,
        to,
        subject,
        text: fullBody,
        headers: {
            'X-Mailer': 'NotiApply',
            'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>`,
        },
    });

    return {
        accepted: info.accepted.length > 0,
        response: info.response,
        messageId: info.messageId,
    };
}

export interface ConnectionTestResult {
    success: boolean;
    error?: string;
}

export async function testSmtpConnection(config: UserConfig): Promise<ConnectionTestResult> {
    // Always use a fresh transporter for verification
    const testTransporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: config.smtp_port ?? (config.smtp_secure ? 465 : 587),
        secure: config.smtp_secure ?? false,
        auth: {
            user: config.smtp_user,
            pass: config.smtp_password,
        },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
    });

    try {
        await testTransporter.verify();
        return { success: true };
    } catch (err) {
        return { success: false, error: (err as Error).message };
    } finally {
        testTransporter.close();
    }
}

export interface DomainHealth {
    spf: boolean;
    dkim: boolean;
    dmarc: boolean;
}

const DKIM_SELECTORS = ['google', 'default', 'selector1', 'selector2', 'k1', 'mail'];

export async function checkDomainHealth(domain: string): Promise<DomainHealth> {
    const result: DomainHealth = { spf: false, dkim: false, dmarc: false };

    // SPF
    try {
        const records = await dns.resolveTxt(domain);
        result.spf = records.flat().some(r => r.startsWith('v=spf1'));
    } catch { /* no SPF */ }

    // DKIM — try common selectors
    for (const selector of DKIM_SELECTORS) {
        try {
            const records = await dns.resolveTxt(`${selector}._domainkey.${domain}`);
            if (records.length > 0) {
                result.dkim = true;
                break;
            }
        } catch { /* try next */ }
    }

    // DMARC
    try {
        const records = await dns.resolveTxt(`_dmarc.${domain}`);
        result.dmarc = records.flat().some(r => r.startsWith('v=DMARC1'));
    } catch { /* no DMARC */ }

    return result;
}

export interface QueueProcessResult {
    sent: boolean;
    contactId?: number;
    error?: string;
}

export async function processEmailQueue(config: UserConfig): Promise<QueueProcessResult> {
    // Dynamic imports to avoid circular dependency at module load time
    const { acquireNextEmailSlot, markEmailSent, markEmailBounced } =
        await import('./db');

    const dailyLimit = config.smtp_daily_limit ?? 30;

    // Atomic check-and-claim: counts today's sends and locks the next contact row
    // in a single transaction so two concurrent calls cannot both pass the daily limit.
    const contact = await acquireNextEmailSlot(dailyLimit);
    if (!contact) {
        // Distinguish "limit reached" from "queue empty" by checking count separately
        // only for the error message — the slot was not taken so no double-send risk.
        const { getSentTodayCount } = await import('./db');
        const sentToday = await getSentTodayCount();
        if (sentToday >= dailyLimit) {
            return { sent: false, error: `Daily limit of ${dailyLimit} reached (${sentToday} sent today)` };
        }
        return { sent: false };
    }
    const subject =
        contact.drafted_subject ||
        `Connecting re: ${contact.company_name}`;

    try {
        const result = await sendEmail(contact.email!, subject, contact.drafted_message!, config);

        if (result.accepted) {
            await markEmailSent(contact.id);
            return { sent: true, contactId: contact.id };
        }

        // Non-exception bounce
        const code = result.response.slice(0, 1);
        if (code === '5') await markEmailBounced(contact.id, 'hard', result.response);
        else if (code === '4') await markEmailBounced(contact.id, 'soft', result.response);
        return { sent: false, contactId: contact.id, error: result.response };

    } catch (err) {
        const msg = (err as Error).message;
        // Detect hard bounces in thrown errors
        if (/\b(550|551|552|553|554)\b/.test(msg)) {
            await markEmailBounced(contact.id, 'hard', msg);
        } else if (/\b(4[0-9]{2})\b/.test(msg)) {
            await markEmailBounced(contact.id, 'soft', msg);
        }
        return { sent: false, contactId: contact.id, error: msg };
    }
}
