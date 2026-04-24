'use client';

import { memo } from 'react';
import type { Job } from '@/lib/types';
import { getCardBorderColor, SOURCE_LABELS, SOURCE_COLORS } from '@/lib/types';
import { timeAgo, formatSalary } from '@/lib/utils';
import CompanyAvatar from '../common/CompanyAvatar';
import Badge from '../common/Badge';
import BaseCard from '../common/kanban/BaseCard';

interface JobCardProps {
    job: Job;
    selected?: boolean;
    onClick: (e: React.MouseEvent) => void;
}

function JobCard({ job, selected = false, onClick }: JobCardProps) {
    const borderColor = getCardBorderColor(job.state);
    const sourceColors = SOURCE_COLORS[job.source] ?? {
        text: 'var(--color-on-surface-variant)',
        bg: 'var(--color-secondary-container)'
    };
    const sourceLabel = SOURCE_LABELS[job.source] ?? job.source;
    const salary = formatSalary(job.salary_min, job.salary_max);
    const ageDays = Math.floor((Date.now() - new Date(job.discovered_at).getTime()) / 86400000);
    const showAgeBadge = job.is_live !== false && ageDays > 30;

    return (
        <BaseCard
            selected={selected}
            onClick={onClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e as unknown as React.MouseEvent); } }}
            role="button"
            tabIndex={0}
            borderColor={borderColor}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <CompanyAvatar name={job.company} logoUrl={job.company_logo_url} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--color-on-surface)',
                        lineHeight: 1.4,
                        letterSpacing: '0.1px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                        title={job.company}
                    >
                        {job.company}
                    </div>
                    <div style={{
                        fontSize: 14,
                        color: 'var(--color-on-surface-secondary)',
                        lineHeight: 1.4,
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                        title={job.title}
                    >
                        {job.title}
                    </div>
                    {(job.location || salary) && (
                        <div
                            title={[job.location, salary].filter(Boolean).join(' · ')}
                            style={{
                                fontSize: 12,
                                color: 'var(--color-on-surface-variant)',
                                marginTop: 4,
                                letterSpacing: '0.4px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {job.location}{salary && ` · ${salary}`}
                        </div>
                    )}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 6,
                        gap: 6
                    }}>
                        <span style={{
                            fontSize: 11,
                            color: 'var(--color-on-surface-disabled)',
                            letterSpacing: '0.5px'
                        }}>
                            {timeAgo(job.discovered_at)}
                        </span>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {job.is_live === false && (
                                <Badge label="Dead posting" color="var(--color-error)" bg="var(--color-error-container)" />
                            )}
                            {showAgeBadge && (
                                <Badge label={`${ageDays}d old`} color="var(--color-warning)" bg="var(--color-warning-container)" />
                            )}
                            <Badge label={sourceLabel} color={sourceColors.text} bg={sourceColors.bg} />
                        </div>
                    </div>
                </div>
            </div>
        </BaseCard>
    );
}

export default memo(JobCard);
