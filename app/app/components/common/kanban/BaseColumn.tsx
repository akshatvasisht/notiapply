'use client';

interface BaseColumnProps {
    label: string;
    count?: number;
    children: React.ReactNode;
    minWidth?: number | string;
    onCollapse?: () => void;
}

export default function BaseColumn({
    label,
    count,
    children,
    minWidth = 240,
    onCollapse,
}: BaseColumnProps) {
    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: minWidth,
            height: '100%',
        }}>
            <div
                onClick={onCollapse}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 8px',
                    marginBottom: 4,
                    cursor: onCollapse ? 'pointer' : 'default',
                    borderRadius: 8,
                    transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                    if (onCollapse) {
                        e.currentTarget.style.background = 'var(--color-surface-container)';
                    }
                }}
                onMouseLeave={(e) => {
                    if (onCollapse) {
                        e.currentTarget.style.background = 'transparent';
                    }
                }}
            >
                <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--color-on-surface-secondary)',
                    flex: 1,
                    userSelect: 'none',
                }}>
                    {label}
                </span>
                {count !== undefined && count > 0 && (
                    <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--color-on-surface-secondary)',
                        background: 'var(--color-outline-variant)',
                        borderRadius: 12,
                        padding: '2px 8px',
                        minWidth: 20,
                        textAlign: 'center',
                    }}>
                        {count}
                    </span>
                )}
                {onCollapse && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--color-on-surface-disabled)',
                            padding: '2px 4px',
                        }}
                    >
                        <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </div>
                )}
            </div>

            <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                paddingRight: 6,
                paddingBottom: 20,
            }}>
                {children}
            </div>
        </div>
    );
}
