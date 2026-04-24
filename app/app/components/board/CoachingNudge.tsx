'use client';

interface Props {
    nudge: string;
}

export default function CoachingNudge({ nudge }: Props) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 8,
            background: 'var(--color-warning-container)',
            border: '1px solid var(--color-warning)',
            color: 'var(--color-warning)', fontSize: 'var(--font-size-sm)',
        }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            {nudge}
        </div>
    );
}
