'use client';
import { useEffect } from 'react';

interface EscapeLayer {
    active: boolean;
    dismiss: () => void;
}

export function useBoardKeyboard(
    escapeLayers: EscapeLayer[],
    selectAllIds: () => number[],
    onSelectAll: (ids: number[]) => void,
) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (e.key === 'Escape') {
                for (const layer of escapeLayers) {
                    if (layer.active) {
                        layer.dismiss();
                        return;
                    }
                }
            }
            if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onSelectAll(selectAllIds());
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [escapeLayers, selectAllIds, onSelectAll]);
}
