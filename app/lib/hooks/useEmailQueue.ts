'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

export interface QueueStatus {
    active: boolean;
    pending: number;
    lastSent: string | null;
    lastError: string | null;
}

export function useEmailQueue(pollIntervalMs = 120_000): QueueStatus & { refresh: () => void } {
    const [status, setStatus] = useState<QueueStatus>({
        active: false,
        pending: 0,
        lastSent: null,
        lastError: null,
    });
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const tick = useCallback(async () => {
        try {
            // Dynamic imports to avoid loading DB/email at module init time
            const { getSecureConfig } = await import('../secure-config');
            const { getEmailQueue } = await import('../db');

            const config = await getSecureConfig();
            if (!config.smtp_host) return; // SMTP not configured — skip silently

            const queue = await getEmailQueue();
            setStatus(s => ({ ...s, pending: queue.length }));

            if (queue.length === 0) return;

            const { processEmailQueue } = await import('../email');
            setStatus(s => ({ ...s, active: true }));
            const result = await processEmailQueue(config);

            setStatus(s => ({
                ...s,
                active: false,
                lastSent: result.sent ? new Date().toISOString() : s.lastSent,
                lastError: result.error ?? null,
                pending: result.sent ? Math.max(0, s.pending - 1) : s.pending,
            }));
        } catch (err) {
            setStatus(s => ({
                ...s,
                active: false,
                lastError: err instanceof Error ? err.message : 'Unknown error',
            }));
        }
    }, []);

    useEffect(() => {
        tick();
        intervalRef.current = setInterval(tick, pollIntervalMs);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [tick, pollIntervalMs]);

    return { ...status, refresh: tick };
}
