'use client';
import { useState, useCallback } from 'react';

export function useCardSelection<T extends { id: number }>() {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const handleCardClick = useCallback((item: T, e: React.MouseEvent, onFocus: (item: T) => void) => {
        if (e.ctrlKey) {
            setSelectedIds(prev => {
                const next = new Set(prev);
                if (next.has(item.id)) next.delete(item.id);
                else next.add(item.id);
                return next;
            });
        } else if (selectedIds.size > 0) {
            setSelectedIds(new Set());
            onFocus(item);
        } else {
            onFocus(item);
        }
    }, [selectedIds]);

    const selectAll = useCallback((ids: number[]) => {
        setSelectedIds(new Set(ids));
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    return { selectedIds, setSelectedIds, handleCardClick, selectAll, clearSelection };
}
