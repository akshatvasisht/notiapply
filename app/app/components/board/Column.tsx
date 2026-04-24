'use client';

import { memo } from 'react';
import type { Job } from '@/lib/types';
import JobCard from './JobCard';
import BaseColumn, { ShowMoreButton } from '../common/kanban/BaseColumn';

interface ColumnProps {
    label: string;
    jobs: Job[];
    selectedIds: Set<number>;
    onCardClick: (job: Job, e: React.MouseEvent) => void;
    collapsible?: boolean;
}

export default memo(function Column({ label, jobs, selectedIds, onCardClick, collapsible = false }: ColumnProps) {
    return (
        <BaseColumn
            label={label}
            count={jobs.length}
            collapsible={collapsible}
            storageKey={collapsible ? `col-collapsed-jobs-${label}` : undefined}
            itemLabel="job"
            totalItems={jobs.length}
            renderItems={(limit, showAll, onShowAll) => {
                if (jobs.length === 0) {
                    return (
                        <div style={{
                            textAlign: 'center', padding: '20px 0',
                            color: 'var(--color-on-surface-disabled)', fontSize: 13,
                        }}>
                            —
                        </div>
                    );
                }
                const displayed = showAll ? jobs : jobs.slice(0, limit);
                const hasMore = jobs.length > limit;
                return (
                    <>
                        {displayed.map(job => (
                            <JobCard
                                key={job.id}
                                job={job}
                                selected={selectedIds.has(job.id)}
                                onClick={(e) => onCardClick(job, e)}
                            />
                        ))}
                        {hasMore && !showAll && (
                            <ShowMoreButton total={jobs.length} itemLabel="job" onClick={onShowAll} />
                        )}
                    </>
                );
            }}
        />
    );
})
