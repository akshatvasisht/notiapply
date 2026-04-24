/**
 * Simple in-memory cache with TTL for a single-user desktop app.
 * No external dependencies — just a Map with timestamps.
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 30_000; // 30 seconds

export function getCached<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > ttlMs) {
        store.delete(key);
        return null;
    }
    return entry.data as T;
}

export function setCache<T>(key: string, data: T): void {
    store.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(keyPrefix?: string): void {
    if (!keyPrefix) {
        store.clear();
        return;
    }
    for (const key of store.keys()) {
        if (key.startsWith(keyPrefix)) store.delete(key);
    }
}
