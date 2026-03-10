'use client';

import { useState } from 'react';

export interface ViewToggleProps {
    value: 'jobs' | 'contacts';
    onChange: (value: 'jobs' | 'contacts') => void;
}

/**
 * Material 3 Segmented Button - iOS-style toggle for Jobs/CRM
 *
 * Design: Smooth slide animation, high-contrast active state
 */
export default function ViewToggle({ value, onChange }: ViewToggleProps) {
    const [hoveredSide, setHoveredSide] = useState<'jobs' | 'contacts' | null>(null);

    return (
        <div
            onClick={() => onChange(value === 'jobs' ? 'contacts' : 'jobs')}
            style={{
                position: 'relative',
                display: 'flex',
                height: 36,
                borderRadius: 18,
                background: 'var(--color-surface-container)',
                border: '1px solid var(--color-outline)',
                padding: 2,
                isolation: 'isolate',
                cursor: 'pointer',
            }}
        >
            {/* Sliding background indicator */}
            <div
                style={{
                    position: 'absolute',
                    top: 2,
                    left: value === 'jobs' ? 2 : 'calc(50%)',
                    width: 'calc(50% - 2px)',
                    height: 'calc(100% - 4px)',
                    borderRadius: 16,
                    background: 'var(--color-surface-container-high)',
                    transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 0,
                    boxShadow: 'var(--elevation-1)',
                }}
            />

            {/* Jobs button */}
            <button
                onMouseEnter={() => setHoveredSide('jobs')}
                onMouseLeave={() => setHoveredSide(null)}
                style={{
                    position: 'relative',
                    zIndex: 1,
                    flex: 1,
                    height: '100%',
                    padding: '0 20px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: value === 'jobs' ? 600 : 500,
                    color: value === 'jobs' ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    letterSpacing: '0.01em',
                    whiteSpace: 'nowrap',
                    opacity: hoveredSide === 'contacts' && value !== 'jobs' ? 0.6 : 1,
                    pointerEvents: 'none', // Allow click to pass to parent
                }}
            >
                Jobs Pipeline
            </button>

            {/* Contacts button */}
            <button
                onMouseEnter={() => setHoveredSide('contacts')}
                onMouseLeave={() => setHoveredSide(null)}
                style={{
                    position: 'relative',
                    zIndex: 1,
                    flex: 1,
                    height: '100%',
                    padding: '0 20px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: value === 'contacts' ? 600 : 500,
                    color: value === 'contacts' ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    letterSpacing: '0.01em',
                    whiteSpace: 'nowrap',
                    opacity: hoveredSide === 'jobs' && value !== 'contacts' ? 0.6 : 1,
                    pointerEvents: 'none', // Allow click to pass to parent
                }}
            >
                Outreach CRM
            </button>
        </div>
    );
}
