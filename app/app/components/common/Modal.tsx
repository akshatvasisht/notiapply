'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
    children: ReactNode;
    onClose: () => void;
    width?: string;
    maxHeight?: string;
    /** Accessible title announced by screen readers when modal opens */
    title?: string;
}

export default function Modal({ children, onClose, width = '85%', maxHeight = '90vh', title }: ModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            // Focus trap: cycle Tab within the dialog
            if (e.key === 'Tab' && dialogRef.current) {
                const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';

        // Focus the dialog on mount
        dialogRef.current?.focus();

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [onClose]);

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-overlay)',
                animation: 'fadeIn 0.1s ease-out',
            }}
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                style={{
                    width,
                    maxWidth: 'min(900px, calc(100vw - 32px))',
                    maxHeight,
                    background: 'var(--color-surface-container)',
                    borderRadius: '16px',
                    boxShadow: 'var(--elevation-3)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'scaleIn 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
}
