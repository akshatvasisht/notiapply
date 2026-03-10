'use client';

import { useState } from 'react';
import type { Job } from '@/lib/types';
import JobCard from './JobCard';
import BaseColumn from '../common/kanban/BaseColumn';
import CollapsedColumnRail from '../common/kanban/CollapsedColumnRail';

interface ColumnProps {
    label: string;
    jobs: Job[];
    selectedIds: Set<number>;
    onCardClick: (job: Job, e: React.MouseEvent) => void;
    collapsible?: boolean;
}

const INITIAL_LIMIT = 20;

export default function Column({ label, jobs, selectedIds, onCardClick, collapsible = false }: ColumnProps) {
    const [showAll, setShowAll] = useState(false);
    const [collapsed, setCollapsed] = useState(collapsible);

    const displayedJobs = showAll ? jobs : jobs.slice(0, INITIAL_LIMIT);
    const hasMore = jobs.length > INITIAL_LIMIT;

    if (collapsed) {
        return (
            <CollapsedColumnRail
                label={label}
                count={jobs.length}
                itemLabel="job"
                onExpand={() => setCollapsed(false)}
            />
        );
    }

    return (
        <BaseColumn
            label={label}
            count={jobs.length}
            onCollapse={collapsible ? () => setCollapsed(true) : undefined}
        >
            {jobs.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '20px 0',
                    color: 'var(--color-on-surface-disabled)', fontSize: 13,
                }}>
                    —
                </div>
            ) : (
                <>
                    {displayedJobs.map(job => (
                        <JobCard
                            key={job.id}
                            job={job}
                            selected={selectedIds.has(job.id)}
                            onClick={(e) => onCardClick(job, e)}
                        />
                    ))}

                    {hasMore && !showAll && (
                        <button
                            onClick={() => setShowAll(true)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                marginTop: 8,
                                background: 'var(--color-surface-container-high)',
                                border: '1px solid var(--color-outline-variant)',
                                borderRadius: 8,
                                color: 'var(--color-primary)',
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--color-primary-container)';
                                e.currentTarget.style.boxShadow = 'var(--elevation-1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'var(--color-surface-container-high)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            Show all {jobs.length} jobs
                        </button>
                    )}
                </>
            )}
        </BaseColumn>
    );
}
