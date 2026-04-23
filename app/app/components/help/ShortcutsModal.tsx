'use client';

import { useEffect } from 'react';

interface ShortcutsModalProps {
    onClose: () => void;
}

const shortcuts = [
    {
        section: 'Global',
        items: [
            { key: '?', description: 'Show this shortcuts help' },
            { key: 'Ctrl+F', description: 'Focus search input' },
            { key: 'Esc', description: 'Close modal / Clear selection' },
        ]
    },
    {
        section: 'Navigation',
        items: [
            { key: '← →', description: 'Navigate between cards in column' },
            { key: 'Enter', description: 'Open focused job in detail view' },
            { key: '1-5', description: 'Jump to column (Incoming/Ready/Attention/Submitted/Archive)' },
            { key: 'Tab', description: 'Cycle through interactive elements' },
        ]
    },
    {
        section: 'Actions',
        items: [
            { key: 'A', description: 'Archive selected job(s)' },
            { key: 'S', description: 'Mark as submitted' },
            { key: 'R', description: 'Reject / Remove from pipeline' },
            { key: 'Ctrl+A', description: 'Select all visible jobs' },
        ]
    },
    {
        section: 'Multi-Select',
        items: [
            { key: 'Ctrl+Click', description: 'Toggle job selection' },
            { key: 'Shift+Click', description: 'Select range of jobs' },
        ]
    }
];

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'var(--color-overlay)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: 'min(600px, 90vw)',
                    maxHeight: '80vh',
                    background: 'var(--color-surface-container)',
                    borderRadius: 16,
                    boxShadow: 'var(--elevation-3)',
                    overflow: 'hidden',
                    animation: 'scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--color-outline-variant)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div>
                        <h2 style={{
                            fontSize: 20,
                            fontWeight: 500,
                            color: 'var(--color-on-surface)',
                            margin: 0,
                        }}>
                            Keyboard Shortcuts
                        </h2>
                        <p style={{
                            fontSize: 13,
                            color: 'var(--color-on-surface-variant)',
                            margin: '4px 0 0 0',
                        }}>
                            Quick reference for power users
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 20,
                            color: 'var(--color-on-surface-variant)',
                            padding: '4px 8px',
                        }}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    padding: 24,
                    maxHeight: 'calc(80vh - 100px)',
                    overflowY: 'auto',
                }}>
                    {shortcuts.map((section, idx) => (
                        <div key={section.section} style={{ marginBottom: idx < shortcuts.length - 1 ? 32 : 0 }}>
                            <h3 style={{
                                fontSize: 13,
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                color: 'var(--color-on-surface-variant)',
                                marginBottom: 12,
                            }}>
                                {section.section}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {section.items.map((item) => (
                                    <div
                                        key={item.key}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            background: 'var(--color-surface-container-low)',
                                        }}
                                    >
                                        <span style={{
                                            fontSize: 13,
                                            color: 'var(--color-on-surface)',
                                        }}>
                                            {item.description}
                                        </span>
                                        <kbd style={{
                                            fontSize: 12,
                                            fontWeight: 500,
                                            padding: '4px 8px',
                                            borderRadius: 4,
                                            background: 'var(--color-surface-raised)',
                                            border: '1px solid var(--color-outline-variant)',
                                            color: 'var(--color-on-surface)',
                                            fontFamily: 'monospace',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {item.key}
                                        </kbd>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid var(--color-outline-variant)',
                    background: 'var(--color-surface-container-low)',
                }}>
                    <p style={{
                        fontSize: 12,
                        color: 'var(--color-on-surface-variant)',
                        margin: 0,
                        lineHeight: 1.5,
                    }}>
                        Press <kbd style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 3,
                            background: 'var(--color-surface-raised)',
                            border: '1px solid var(--color-outline-variant)',
                            fontFamily: 'monospace',
                        }}>?</kbd> anytime to show this help. Press <kbd style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 3,
                            background: 'var(--color-surface-raised)',
                            border: '1px solid var(--color-outline-variant)',
                            fontFamily: 'monospace',
                        }}>Esc</kbd> to close.
                    </p>
                </div>
            </div>
        </div>
    );
}
