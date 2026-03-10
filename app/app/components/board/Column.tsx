import type { Job } from '@/lib/types';
import JobCard from './JobCard';
import BaseColumn from '../common/kanban/BaseColumn';

interface ColumnProps {
    label: string;
    jobs: Job[];
    selectedIds: Set<number>;
    onCardClick: (job: Job, e: React.MouseEvent) => void;
}

export default function Column({ label, jobs, selectedIds, onCardClick }: ColumnProps) {
    return (
        <BaseColumn label={label} count={jobs.length}>
            {jobs.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '20px 0',
                    color: 'var(--color-on-surface-disabled)', fontSize: 13,
                }}>
                    —
                </div>
            ) : (
                jobs.map(job => (
                    <JobCard
                        key={job.id}
                        job={job}
                        selected={selectedIds.has(job.id)}
                        onClick={(e) => onCardClick(job, e)}
                    />
                ))
            )}
        </BaseColumn>
    );
}
