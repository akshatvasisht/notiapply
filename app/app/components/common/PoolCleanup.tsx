'use client';

import { useEffect } from 'react';
import { closePool } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Component that handles PostgreSQL connection pool cleanup on app unmount.
 * Prevents resource leaks when the Tauri app closes.
 */
export default function PoolCleanup() {
    useEffect(() => {
        return () => {
            closePool()
                .then(() => logger.info('Database connection pool closed', 'PoolCleanup'))
                .catch(err => logger.error('Failed to close pool', 'PoolCleanup', err));
        };
    }, []);

    return null;
}
