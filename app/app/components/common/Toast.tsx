'use client';

import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    onDismiss: () => void;
}

const toastColors: Record<ToastType, { bg: string; text: string; border: string }> = {
    success: {
        bg: 'var(--color-success-container)',
        text: 'var(--color-success)',
        border: 'var(--color-success)',
    },
    error: {
        bg: 'var(--color-error-container)',
        text: 'var(--color-error)',
        border: 'var(--color-error)',
    },
    warning: {
        bg: 'var(--color-warning-container)',
        text: 'var(--color-warning)',
        border: 'var(--color-warning)',
    },
    info: {
        bg: 'var(--color-info-container)',
        text: 'var(--color-info)',
        border: 'var(--color-info)',
    },
};

export default function Toast({ message, type, onDismiss }: ToastProps) {
    const colors = toastColors[type];

    useEffect(() => {
        const timer = setTimeout(onDismiss, 3000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                position: 'fixed',
                bottom: 24,
                left: 24,
                right: 24,
                maxWidth: 400,
                marginLeft: 'auto',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: '12px 16px',
                boxShadow: 'var(--elevation-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                zIndex: 1000,
                animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            <span
                style={{
                    fontSize: 13,
                    color: colors.text,
                    fontWeight: 500,
                    lineHeight: 1.4,
                }}
            >
                {message}
            </span>
            <button
                onClick={onDismiss}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                    color: colors.text,
                    padding: '8px 12px',
                    lineHeight: 1,
                    minWidth: 44,
                    minHeight: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                aria-label="Dismiss"
            >
                ×
            </button>
        </div>
    );
}
