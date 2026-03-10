'use client';

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
            onClick={onClick}
            style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                background: 'transparent',
                color,
                border: `1px solid ${color}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.background = color;
                e.currentTarget.style.color = 'var(--color-text-inverse)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = color;
            }}
        >
            {label}
        </button>
    );
}
