'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getCached, setCache, invalidateCache } from '../cache';
import { hasDatabase } from '../db';

interface UseDbQueryResult<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refresh: () => void;
}

export function useDbQuery<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { ttlMs?: number; fallback?: T }
): UseDbQueryResult<T> {
    const dbAvailable = hasDatabase();
    const fallback = options?.fallback;
    const [data, setData] = useState<T | null>(() => getCached<T>(key) ?? fallback ?? null);
    const [loading, setLoading] = useState<boolean>(dbAvailable && !getCached(key));
    const [error, setError] = useState<Error | null>(null);
    const fetcherRef = useRef(fetcher);
    useEffect(() => {
        fetcherRef.current = fetcher;
    }, [fetcher]);

    const refresh = useCallback(() => {
        if (!dbAvailable) {
            if (fallback !== undefined) setData(fallback);
            setLoading(false);
            return;
        }
        invalidateCache(key);
        // Don't set loading: true — keep showing stale data while re-fetching
        // to avoid unmounting the board and replaying card animations.
        fetcherRef.current()
            .then(result => {
                setCache(key, result);
                setData(result);
                setError(null);
            })
            .catch(err => {
                setError(err);
                if (fallback !== undefined) setData(fallback);
            })
            .finally(() => setLoading(false));
    }, [key, fallback, dbAvailable]);

    useEffect(() => {
        if (!dbAvailable) return;
        const cached = getCached<T>(key);
        if (cached) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing React state from the external cache store when key changes
            setData(cached);
            setLoading(false);
            return;
        }
        refresh();
    }, [key, refresh, dbAvailable]);

    return { data, loading, error, refresh };
}
