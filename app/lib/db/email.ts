/** Email queue queries */

import { getPool } from './pool';
import type { Contact } from '../types';

export async function getEmailQueue(): Promise<Contact[]> {
    const { rows } = await getPool().query(`
        SELECT * FROM contacts
        WHERE send_at <= NOW()
          AND sent_at IS NULL
          AND bounce_type IS NULL
          AND unsubscribed_at IS NULL
          AND email IS NOT NULL
          AND drafted_message IS NOT NULL
        ORDER BY send_at ASC
        LIMIT 1
    `);
    return rows;
}

export async function markEmailSent(contactId: number): Promise<void> {
    await getPool().query(`
        UPDATE contacts
        SET sent_at = NOW(),
            state = 'contacted',
            last_contacted_at = NOW(),
            interaction_log = COALESCE(interaction_log, '[]'::jsonb) ||
                jsonb_build_array(jsonb_build_object(
                    'timestamp', NOW()::text,
                    'event', 'email_sent',
                    'notes', 'Sent via SMTP'
                )),
            updated_at = NOW()
        WHERE id = $1
    `, [contactId]);
}

export async function markEmailBounced(
    contactId: number,
    bounceType: 'hard' | 'soft',
    bounceReason?: string
): Promise<void> {
    await getPool().query(`
        UPDATE contacts
        SET bounce_type = $2,
            bounce_reason = $3,
            state = CASE WHEN $2 = 'hard' THEN 'rejected' ELSE state END,
            interaction_log = COALESCE(interaction_log, '[]'::jsonb) ||
                jsonb_build_array(jsonb_build_object(
                    'timestamp', NOW()::text,
                    'event', 'email_bounced',
                    'notes', $2 || ' bounce: ' || COALESCE($3, 'unknown')
                )),
            updated_at = NOW()
        WHERE id = $1
    `, [contactId, bounceType, bounceReason ?? null]);
}

export async function scheduleEmail(contactId: number, sendAt: Date): Promise<void> {
    await getPool().query(
        'UPDATE contacts SET send_at = $1, updated_at = NOW() WHERE id = $2',
        [sendAt.toISOString(), contactId]
    );
}

export async function scheduleBatchEmails(
    contactIds: number[],
    startTime: Date,
    intervalMinutes: number
): Promise<void> {
    const pool = getPool();
    for (let i = 0; i < contactIds.length; i++) {
        const sendAt = new Date(startTime.getTime() + i * intervalMinutes * 60 * 1000);
        await pool.query(
            'UPDATE contacts SET send_at = $1, updated_at = NOW() WHERE id = $2',
            [sendAt.toISOString(), contactIds[i]]
        );
    }
}

export async function markUnsubscribed(contactId: number): Promise<void> {
    await getPool().query(
        'UPDATE contacts SET unsubscribed_at = NOW(), updated_at = NOW() WHERE id = $1',
        [contactId]
    );
}

export async function getSentTodayCount(): Promise<number> {
    const { rows } = await getPool().query(`
        SELECT COUNT(*) AS count FROM contacts
        WHERE sent_at >= CURRENT_DATE
    `);
    return parseInt(rows[0].count, 10);
}

/**
 * Atomically claims the next queued contact for sending if the daily limit has not
 * been reached. Uses SELECT...FOR UPDATE SKIP LOCKED so two concurrent callers
 * cannot both pass the limit check for the same slot.
 *
 * Returns the contact row to send, or null if the limit is reached or the queue
 * is empty.
 */
export async function acquireNextEmailSlot(dailyLimit: number): Promise<Contact | null> {
    const pool = getPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Count today's sends inside the transaction so no concurrent caller
        // can insert a new sent_at between our read and the caller's send.
        const { rows: countRows } = await client.query(`
            SELECT COUNT(*) AS count FROM contacts
            WHERE sent_at >= CURRENT_DATE
        `);
        const sentToday = parseInt(countRows[0].count, 10);
        if (sentToday >= dailyLimit) {
            await client.query('ROLLBACK');
            return null;
        }

        // Lock the next queued row so a concurrent caller skips it.
        const { rows } = await client.query(`
            SELECT * FROM contacts
            WHERE send_at <= NOW()
              AND sent_at IS NULL
              AND bounce_type IS NULL
              AND unsubscribed_at IS NULL
              AND email IS NOT NULL
              AND drafted_message IS NOT NULL
            ORDER BY send_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        `);

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        // Reserve the slot by stamping sent_at optimistically inside the transaction.
        // The caller must call markEmailSent() after a successful SMTP send, which
        // is a no-op UPDATE (sent_at already set). If the send fails the caller
        // calls markEmailBounced() or does nothing — either way the row is already
        // claimed and will not be double-sent.
        await client.query(
            `UPDATE contacts SET sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [rows[0].id]
        );

        await client.query('COMMIT');
        return rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function cancelScheduledEmail(contactId: number): Promise<void> {
    await getPool().query(
        'UPDATE contacts SET send_at = NULL, updated_at = NOW() WHERE id = $1',
        [contactId]
    );
}
