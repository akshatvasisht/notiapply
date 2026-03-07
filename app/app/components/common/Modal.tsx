'use client';

import { useEffect, type ReactNode } from 'react';

interface ModalProps {
    children: ReactNode;
    onClose: () => void;
    width?: string;
    maxHeight?: string;
}

export default function Modal({ children, onClose, width = '85%', maxHeight = '90vh' }: ModalProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleEscape);
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
                background: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(4px)',
                animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width,
                    maxHeight,
                    background: 'var(--color-surface-container)',
                    borderRadius: '16px',
                    boxShadow: 'var(--elevation-3)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
}
