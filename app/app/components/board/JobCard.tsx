'use client';

import type { Job } from '@/lib/types';
import { getCardBorderColor, SOURCE_LABELS, SOURCE_COLORS } from '@/lib/types';

interface JobCardProps {
    job: Job;
    onClick: () => void;
}

import { timeAgo, formatSalary } from '@/lib/utils';

function LetterAvatar({ name }: { name: string }) {
    const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hue = hash % 360;
    return (
        <div style={{
            width: 24, height: 24, borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            background: `hsl(${hue}, 60%, 85%)`,
            color: `hsl(${hue}, 60%, 35%)`,
            fontSize: 11, fontWeight: 600,
        }}>
            {name.charAt(0).toUpperCase()}
        </div>
    );
}

export default function JobCard({ job, onClick }: JobCardProps) {
    const borderColor = getCardBorderColor(job.state);
    const sourceColors = SOURCE_COLORS[job.source] ?? { text: 'var(--color-text-tertiary)', bg: 'var(--color-surface-raised)' };
    const sourceLabel = SOURCE_LABELS[job.source] ?? job.source;
    const salary = formatSalary(job.salary_min, job.salary_max);

    return (
        <div
            onClick={onClick}
            style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderLeft: `3px solid ${borderColor}`,
                borderRadius: 6, padding: '10px 12px', cursor: 'pointer',
                transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <LetterAvatar name={job.company} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
                        {job.company}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.3, marginTop: 1 }}>
                        {job.title}
                    </div>
                    {(job.location || salary) && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 3 }}>
                            {job.location}{salary && ` · ${salary}`}
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--color-text-disabled)' }}>
                            {timeAgo(job.discovered_at)}
                        </span>
                        <span style={{
                            fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 4,
                            color: sourceColors.text, background: sourceColors.bg,
                        }}>
                            {sourceLabel}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
