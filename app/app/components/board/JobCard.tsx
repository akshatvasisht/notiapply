'use client';

import { useState } from 'react';
import type { Job } from '@/lib/types';
import { getCardBorderColor, SOURCE_LABELS, SOURCE_COLORS } from '@/lib/types';
import { timeAgo, formatSalary } from '@/lib/utils';
import CompanyAvatar from '../common/CompanyAvatar';
import BaseCard from '../common/kanban/BaseCard';

interface JobCardProps {
    job: Job;
    selected?: boolean;
    onClick: (e: React.MouseEvent) => void;
}

export default function JobCard({ job, selected = false, onClick }: JobCardProps) {
    const borderColor = getCardBorderColor(job.state);
    const sourceColors = SOURCE_COLORS[job.source] ?? {
        text: 'var(--color-on-surface-variant)',
        bg: 'var(--color-secondary-container)'
    };
    const sourceLabel = SOURCE_LABELS[job.source] ?? job.source;
    const salary = formatSalary(job.salary_min, job.salary_max);

    return (
        <BaseCard
            selected={selected}
            onClick={onClick}
            borderColor={borderColor}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <CompanyAvatar name={job.company} logoUrl={job.company_logo_url} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--color-on-surface)',
                        lineHeight: 1.4,
                        letterSpacing: '0.1px'
                    }}>
                        {job.company}
                    </div>
                    <div style={{
                        fontSize: 14,
                        color: 'var(--color-on-surface-secondary)',
                        lineHeight: 1.4,
                        marginTop: 2
                    }}>
                        {job.title}
                    </div>
                    {(job.location || salary) && (
                        <div style={{
                            fontSize: 12,
                            color: 'var(--color-on-surface-variant)',
                            marginTop: 6,
                            letterSpacing: '0.4px'
                        }}>
                            {job.location}{salary && ` · ${salary}`}
                        </div>
                    )}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 10,
                        gap: 8
                    }}>
                        <span style={{
                            fontSize: 11,
                            color: 'var(--color-on-surface-disabled)',
                            letterSpacing: '0.5px'
                        }}>
                            {timeAgo(job.discovered_at)}
                        </span>
                        <span style={{
                            fontSize: 11,
                            fontWeight: 500,
                            padding: '3px 10px',
                            borderRadius: 12,
                            color: sourceColors.text,
                            background: sourceColors.bg,
                            letterSpacing: '0.5px',
                            whiteSpace: 'nowrap'
                        }}>
                            {sourceLabel}
                        </span>
                    </div>
                </div>
            </div>
        </BaseCard>
    );
}
