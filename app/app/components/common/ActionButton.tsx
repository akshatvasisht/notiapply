'use client';

import React from 'react';

/**
 * Shared action button — outline style with hover fill.
 * Used in FocusMode (job popup) and ContactDetail (CRM popup).
 */
export default function ActionButton({
    label,
    color,
    onClick,
}: {
    label: string;
    color: string;
    onClick: () => void;
}) {
    return (
        <button
            className="action-btn"
            onClick={onClick}
            style={{
                '--action-color': color,
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                background: 'transparent',
                color,
                border: `1px solid ${color}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
            } as React.CSSProperties}
        >
            {label}
        </button>
    );
}
