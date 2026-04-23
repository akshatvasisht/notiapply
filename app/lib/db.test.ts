import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Pool } from 'pg';
import {
    initPool,
    getPool,
    updateJobCallback,
    updateContactResponse,
    addContactInteraction,
    getCallbackAnalytics,
} from './db';

const hasDb = !!(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);

describe.skipIf(!hasDb)('Database Operations (integration — requires PostgreSQL)', () => {
    let testPool: Pool;
    let testJobId: number;
    let testContactId: number;

    beforeAll(async () => {
        // Use test database
        const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://localhost/notiapply_test';
        initPool(testDbUrl);
        testPool = getPool();

        // Create test job
        const { rows: jobRows } = await testPool.query(
            `INSERT INTO jobs (company, title, location, url, state, source)
             VALUES ('Test Co', 'Test Engineer', 'Remote', 'https://test.com', 'submitted', 'manual')
             RETURNING id`
        );
        testJobId = jobRows[0].id;

        // Create test contact
        const { rows: contactRows } = await testPool.query(
            `INSERT INTO contacts (name, email, company_name, state)
             VALUES ('Test Person', 'test@test.com', 'Test Co', 'contacted')
             RETURNING id`
        );
        testContactId = contactRows[0].id;
    });

    afterAll(async () => {
        // Cleanup
        await testPool.query('DELETE FROM jobs WHERE id = $1', [testJobId]);
        await testPool.query('DELETE FROM contacts WHERE id = $1', [testContactId]);
        await testPool.end();
    });

    it('should update job callback status', async () => {
        await updateJobCallback(testJobId, true, 'Phone screen scheduled');

        const { rows } = await testPool.query(
            'SELECT got_callback, callback_notes FROM jobs WHERE id = $1',
            [testJobId]
        );

        expect(rows[0].got_callback).toBe(true);
        expect(rows[0].callback_notes).toBe('Phone screen scheduled');
    });

    it('should update contact response status', async () => {
        await updateContactResponse(testContactId, true);

        const { rows } = await testPool.query(
            'SELECT got_response FROM contacts WHERE id = $1',
            [testContactId]
        );

        expect(rows[0].got_response).toBe(true);
    });

    it('should add contact interaction', async () => {
        await addContactInteraction(testContactId, 'Follow-up sent', 'Sent reminder email');

        const { rows } = await testPool.query(
            'SELECT interaction_log FROM contacts WHERE id = $1',
            [testContactId]
        );

        const log = rows[0].interaction_log;
        expect(Array.isArray(log)).toBe(true);
        expect(log.length).toBeGreaterThan(0);
        expect(log[log.length - 1].event).toBe('Follow-up sent');
        expect(log[log.length - 1].notes).toBe('Sent reminder email');
    });

    it('should calculate callback analytics', async () => {
        const stats = await getCallbackAnalytics();

        expect(stats).toHaveProperty('total_applications');
        expect(stats).toHaveProperty('total_callbacks');
        expect(stats).toHaveProperty('callback_rate');
        expect(typeof stats.total_applications).toBe('number');
        expect(typeof stats.total_callbacks).toBe('number');
        expect(typeof stats.callback_rate).toBe('number');
    });
});
