'use client';

interface CollapsedColumnRailProps {
    label: string;
    count: number;
    itemLabel?: string; // e.g. "job" or "contact"
    onExpand: () => void;
}

/**
 * A slim 48px-wide placeholder for a collapsed Kanban column.
 * Shows a rotated label, count badge, and a chevron to expand.
 * Used by both Column (jobs) and ContactColumn (CRM) for parity.
 */
export default function CollapsedColumnRail({
    label,
    count,
    itemLabel = 'item',
    onExpand,
}: CollapsedColumnRailProps) {
    const tooltip = `Show ${count} ${itemLabel}${count !== 1 ? 's' : ''}`;

    return (
        <div
            onClick={onExpand}
            title={tooltip}
            style={{
                flex: '0 0 auto',
                width: 48,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingTop: 16,
                gap: 10,
                cursor: 'pointer',
                borderRadius: 8,
                background: 'transparent',
                transition: 'background 0.15s ease',
                userSelect: 'none',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-container)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
            }}
        >
            {/* Expand chevron */}
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: 'var(--color-on-surface-disabled)', flexShrink: 0 }}
            >
                <polyline points="9 18 15 12 9 6" />
            </svg>

            {/* Rotated label */}
            <div style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                transform: 'rotate(180deg)',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-on-surface-disabled)',
                lineHeight: 1,
            }}>
                {label}
            </div>

            {/* Count badge */}
            {count > 0 && (
                <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--color-on-surface-disabled)',
                    background: 'var(--color-outline-variant)',
                    borderRadius: 12,
                    padding: '3px 7px',
                    minWidth: 20,
                    textAlign: 'center',
                }}>
                    {count}
                </span>
            )}
        </div>
    );
}
