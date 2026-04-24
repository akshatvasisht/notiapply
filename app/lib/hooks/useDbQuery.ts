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
    const [data, setData] = useState<T | null>(() => getCached<T>(key) ?? options?.fallback ?? null);
    const [loading, setLoading] = useState<boolean>(dbAvailable && !getCached(key));
    const [error, setError] = useState<Error | null>(null);
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    const refresh = useCallback(() => {
        if (!dbAvailable) {
            if (options?.fallback !== undefined) setData(options.fallback);
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
                if (options?.fallback !== undefined) setData(options.fallback);
            })
            .finally(() => setLoading(false));
    }, [key, options?.fallback, dbAvailable]);

    useEffect(() => {
        if (!dbAvailable) {
            if (options?.fallback !== undefined) setData(options.fallback);
            setLoading(false);
            return;
        }
        const cached = getCached<T>(key);
        if (cached) {
            setData(cached);
            setLoading(false);
            return;
        }
        refresh();
    }, [key, refresh, dbAvailable, options?.fallback]);

    return { data, loading, error, refresh };
}
