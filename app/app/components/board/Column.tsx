'use client';

import type { Job } from '@/lib/types';
import JobCard from './JobCard';

interface ColumnProps {
    label: string;
    jobs: Job[];
    onCardClick: (job: Job) => void;
}

export default function Column({ label, jobs, onCardClick }: ColumnProps) {
    return (
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', minWidth: 200,
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 4px', marginBottom: 4,
            }}>
                <span style={{
                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: 'var(--color-text-tertiary)',
                }}>
                    {label}
                </span>
                {jobs.length > 0 && (
                    <span style={{
                        fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)',
                        background: 'var(--color-border)', borderRadius: 8, padding: '1px 6px',
                    }}>
                        {jobs.length}
                    </span>
                )}
            </div>

            <div style={{
                flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6,
                paddingRight: 4,
            }}>
                {jobs.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '20px 0',
                        color: 'var(--color-text-disabled)', fontSize: 13,
                    }}>
                        —
                    </div>
                ) : (
                    jobs.map(job => (
                        <JobCard key={job.id} job={job} onClick={() => onCardClick(job)} />
                    ))
                )}
            </div>
        </div>
    );
}
