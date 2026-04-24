'use client';

import { useEffect } from 'react';
import { closePool, hasDatabase, recoverStuckJobs, archiveOldJobs, getUserConfig } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Component that handles PostgreSQL connection pool cleanup on app unmount.
 * Also recovers jobs stuck in 'filling' state from previous sidecar crashes (H-01).
 * Prevents resource leaks when the Tauri app closes.
 * Silently no-ops when DATABASE_URL is not set (demo/mock mode).
 */
export default function PoolCleanup() {
    useEffect(() => {
        if (!hasDatabase()) return;

        // Recover jobs stuck in 'filling' state from a previous crash
        recoverStuckJobs().catch(err =>
            logger.warn('Failed to recover stuck jobs', 'PoolCleanup', err)
        );

        // Archive old rejected/filtered jobs based on user's archive_after_months setting
        getUserConfig().then(config => {
            if (config?.archive_after_months) {
                return archiveOldJobs(config.archive_after_months);
            }
        }).then(archived => {
            if (archived && archived > 0) {
                logger.info(`Archived ${archived} old jobs`, 'PoolCleanup');
            }
        }).catch(err =>
            logger.warn('Failed to archive old jobs', 'PoolCleanup', err)
        );
        return () => {
            closePool()
                .then(() => logger.info('Database connection pool closed', 'PoolCleanup'))
                .catch(err => logger.error('Failed to close pool', 'PoolCleanup', err));
        };
    }, []);

    return null;
}
