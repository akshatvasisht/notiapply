'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { getScraperRuns } from '@/lib/db';
import type { ScraperRun } from '@/lib/types';

export default function MonitoringPage() {
    const [runs, setRuns] = useState<ScraperRun[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getScraperRuns(50)
            .then(setRuns)
            .catch(err => {
                logger.error('Failed to load scraper runs', 'MonitoringPage', err);
                setRuns([]);
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div style={{ padding: 32 }}>
                <div style={{
                    fontSize: 14,
                    color: 'var(--color-text-secondary)',
                }}>
                    Loading...
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: 32 }}>
            <h1 style={{
                fontSize: 24,
                fontWeight: 600,
                marginBottom: 32,
                color: 'var(--color-text-primary)',
            }}>
                Scraper Monitoring
            </h1>

            {runs.length === 0 ? (
                <div style={{
                    padding: 24,
                    borderRadius: 12,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    fontSize: 14,
                    color: 'var(--color-text-secondary)',
                    textAlign: 'center',
                }}>
                    No scraper runs found. Run scrapers to see monitoring data here.
                </div>
            ) : (
                <div style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: 'var(--color-surface)',
                }}>
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                    }}>
                        <thead>
                            <tr style={{
                                borderBottom: '1px solid var(--color-border)',
                                background: 'var(--color-surface-raised)',
                            }}>
                                <th style={{
                                    textAlign: 'left',
                                    padding: '12px 16px',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: 'var(--color-text-secondary)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px',
                                }}>
                                    Scraper
                                </th>
                                <th style={{
                                    textAlign: 'left',
                                    padding: '12px 16px',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: 'var(--color-text-secondary)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px',
                                }}>
                                    Started
                                </th>
                                <th style={{
                                    textAlign: 'left',
                                    padding: '12px 16px',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: 'var(--color-text-secondary)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px',
                                }}>
                                    Status
                                </th>
                                <th style={{
                                    textAlign: 'right',
                                    padding: '12px 16px',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: 'var(--color-text-secondary)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px',
                                }}>
                                    Jobs Found
                                </th>
                                <th style={{
                                    textAlign: 'left',
                                    padding: '12px 16px',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: 'var(--color-text-secondary)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px',
                                }}>
                                    Errors
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map(run => (
                                <tr
                                    key={run.id}
                                    style={{
                                        borderBottom: '1px solid var(--color-border)',
                                    }}
                                >
                                    <td style={{
                                        padding: '12px 16px',
                                        fontSize: 14,
                                        color: 'var(--color-text-primary)',
                                        fontWeight: 500,
                                    }}>
                                        {run.scraper_key}
                                    </td>
                                    <td style={{
                                        padding: '12px 16px',
                                        fontSize: 13,
                                        color: 'var(--color-text-tertiary)',
                                    }}>
                                        {new Date(run.started_at).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: 4,
                                            fontSize: 11,
                                            fontWeight: 500,
                                            background: run.status === 'success'
                                                ? 'var(--color-success-container)'
                                                : run.status === 'failed'
                                                    ? 'var(--color-error-container)'
                                                    : 'var(--color-warning-container)',
                                            color: run.status === 'success'
                                                ? 'var(--color-success)'
                                                : run.status === 'failed'
                                                    ? 'var(--color-error)'
                                                    : 'var(--color-warning)',
                                        }}>
                                            {run.status}
                                        </span>
                                    </td>
                                    <td style={{
                                        padding: '12px 16px',
                                        textAlign: 'right',
                                        fontSize: 14,
                                        fontWeight: 500,
                                        color: 'var(--color-text-primary)',
                                    }}>
                                        {run.jobs_found}
                                    </td>
                                    <td style={{
                                        padding: '12px 16px',
                                        fontSize: 12,
                                        color: 'var(--color-error)',
                                    }}>
                                        {run.errors && run.errors.length > 0 ? run.errors.join(', ') : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
