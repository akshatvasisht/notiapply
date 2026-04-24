'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { getLatestScraperRuns, getFailedScraperRuns, hasDatabase } from '@/lib/db';
import type { ScraperRun } from '@/lib/types';

export default function MonitoringPage() {
    const [runs, setRuns] = useState<ScraperRun[]>([]);
    const [failedRuns, setFailedRuns] = useState<ScraperRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!hasDatabase()) {
            setError('Database not connected — monitoring requires a live database');
            setLoading(false);
            return;
        }
        Promise.all([
            getLatestScraperRuns(),
            getFailedScraperRuns(),
        ])
            .then(([latest, failed]) => {
                setRuns(latest);
                setFailedRuns(failed);
            })
            .catch(err => {
                logger.error('Failed to load scraper runs', 'MonitoringPage', err);
                setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div style={{ padding: 32 }}>
                <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                    Loading...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: 32 }}>
                <div style={{ fontSize: 14, color: 'var(--color-error)', marginBottom: 8 }}>
                    Failed to load monitoring data: {error}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    Check that the database is reachable and try again.
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

            <h2 style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 16,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
            }}>
                Latest Run per Scraper
            </h2>

            {runs.length === 0 ? (
                <div style={{
                    padding: 24,
                    borderRadius: 12,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    fontSize: 14,
                    color: 'var(--color-text-secondary)',
                    textAlign: 'center',
                    marginBottom: 32,
                }}>
                    No scraper runs found. Run scrapers to see monitoring data here.
                </div>
            ) : (
                <div style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: 'var(--color-surface)',
                    marginBottom: 32,
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{
                                borderBottom: '1px solid var(--color-border)',
                                background: 'var(--color-surface-raised)',
                            }}>
                                {['Scraper', 'Started', 'Status', 'Jobs Found', 'Errors'].map((label, i) => (
                                    <th key={label} style={{
                                        textAlign: i === 3 ? 'right' : 'left',
                                        padding: '12px 16px',
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: 'var(--color-text-secondary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.3px',
                                    }}>
                                        {label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map(run => (
                                <ScraperRunRow key={run.id} run={run} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {failedRuns.length > 0 && (
                <>
                    <h2 style={{
                        fontSize: 16,
                        fontWeight: 600,
                        marginBottom: 16,
                        color: 'var(--color-error)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                    }}>
                        Recent Failures
                    </h2>
                    <div style={{
                        border: '1px solid var(--color-error-container)',
                        borderRadius: 12,
                        overflow: 'hidden',
                        background: 'var(--color-surface)',
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{
                                    borderBottom: '1px solid var(--color-error-container)',
                                    background: 'var(--color-error-container)',
                                }}>
                                    {['Scraper', 'Started', 'Status', 'Jobs Found', 'Errors'].map((label, i) => (
                                        <th key={label} style={{
                                            textAlign: i === 3 ? 'right' : 'left',
                                            padding: '12px 16px',
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: 'var(--color-error)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.3px',
                                        }}>
                                            {label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {failedRuns.map(run => (
                                    <ScraperRunRow key={run.id} run={run} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

function ScraperRunRow({ run }: { run: ScraperRun }) {
    return (
        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
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
    );
}
