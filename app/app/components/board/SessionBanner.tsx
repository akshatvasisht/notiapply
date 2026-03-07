'use client';

import type { SidecarEvent } from '@/lib/types';

interface SessionBannerProps {
    running: boolean;
    result: SidecarEvent | null;
    onDismiss: () => void;
}

export default function SessionBanner({ running, result, onDismiss }: SessionBannerProps) {
    if (!running && !result) return null;

    return (
        <div style={{
            height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
            background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)',
            fontSize: 12, color: 'var(--color-text-secondary)', padding: '0 16px',
            animation: 'fadeUp 0.2s ease-out',
        }}>
            {running ? (
                <span style={{ color: 'var(--color-warning)', fontWeight: 500 }}>
                    ◌ Running...
                </span>
            ) : result ? (
                <>
                    <span style={{ color: 'var(--color-success)', fontWeight: 500 }}>
                        ✓ Session complete
                    </span>
                    <span>{result.filled} ready · {result.incomplete} attention · {result.failed} failed</span>
                    <button
                        onClick={onDismiss}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--color-text-tertiary)', fontSize: 16,
                        }}
                        aria-label="Dismiss"
                    >
                        ×
                    </button>
                </>
            ) : null}
        </div>
    );
}
