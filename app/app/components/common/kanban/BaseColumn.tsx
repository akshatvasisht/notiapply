'use client';

interface BaseColumnProps {
    label: string;
    count?: number;
    children: React.ReactNode;
    minWidth?: number | string;
}

export default function BaseColumn({
    label,
    count,
    children,
    minWidth = 240
}: BaseColumnProps) {
    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: minWidth,
            height: '100%',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 8px',
                marginBottom: 4,
            }}>
                <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--color-on-surface-secondary)',
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
            </div>

            <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                paddingRight: 6,
                paddingBottom: 20, // Cushion at the bottom
            }}>
                {children}
            </div>
        </div>
    );
}
