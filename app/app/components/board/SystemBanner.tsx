'use client';

import type { SidecarEvent } from '@/lib/types';

export type SystemBannerType = 'session' | 'error' | 'warning' | 'info';

interface SystemBannerProps {
    type: SystemBannerType;
    running?: boolean;
    result?: SidecarEvent | null;
    message?: string;
    onDismiss: () => void;
}

export default function SystemBanner({ type, running, result, message, onDismiss }: SystemBannerProps) {
    // Session-specific rendering (backward compatible with SessionBanner)
    if (type === 'session') {
        if (!running && !result) return null;

        return (
            <div role="status" aria-live="polite" style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                background: 'var(--color-surface)',
                borderTop: '1px solid var(--color-border)',
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                padding: '0 16px',
                zIndex: 100,
                animation: 'fadeUp 0.2s ease-out',
            }}>
                {running ? (
                    <span style={{ color: 'var(--color-warning)', fontWeight: 500 }}>
                        ◌ Running...
                    </span>
                ) : result && result.event === 'done' ? (
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

    // Generic message rendering
    if (!message) return null;

    const colors = {
        error: {
            bg: 'var(--color-error-container)',
            border: 'var(--color-error)',
            text: 'var(--color-error)',
            icon: '✕',
        },
        warning: {
            bg: 'var(--color-warning-container)',
            border: 'var(--color-warning)',
            text: 'var(--color-warning)',
            icon: '!',
        },
        info: {
            bg: 'var(--color-info-container)',
            border: 'var(--color-info)',
            text: 'var(--color-info)',
            icon: 'ℹ',
        },
    };

    const style = colors[type as keyof typeof colors];
    if (!style) return null;

    return (
        <div role="status" aria-live="polite" style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: style.bg,
            borderTop: `1px solid ${style.border}`,
            fontSize: 12,
            padding: '0 16px',
            zIndex: 100,
            animation: 'fadeUp 0.2s ease-out',
        }}>
            <span style={{ color: style.text, fontWeight: 500 }}>
                {style.icon} {message}
            </span>
            <button
                onClick={onDismiss}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: style.text, fontSize: 16, marginLeft: 'auto',
                }}
                aria-label="Dismiss"
            >
                ×
            </button>
        </div>
    );
}
