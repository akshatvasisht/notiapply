'use client';

interface BadgeProps {
    label: string;
    color: string;
    bg: string;
}

export default function Badge({ label, color, bg }: BadgeProps) {
    return (
        <span style={{
            fontSize: 11,
            fontWeight: 500,
            padding: '2px 8px',
            borderRadius: 10,
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
            color,
            background: bg,
        }}>
            {label}
        </span>
    );
}
