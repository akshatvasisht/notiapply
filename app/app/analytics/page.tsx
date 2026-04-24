'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { getCallbackAnalytics, getSourceConversionRates, getScoreConversionBuckets, hasDatabase } from '@/lib/db';
import type { SourceConversionRate, ScoreConversionBucket } from '@/lib/db';
import type { CallbackStats } from '@/lib/types';


export default function AnalyticsPage() {
    const [stats, setStats] = useState<CallbackStats | null>(null);
    const [sourceRates, setSourceRates] = useState<SourceConversionRate[]>([]);
    const [scoreBuckets, setScoreBuckets] = useState<ScoreConversionBucket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!hasDatabase()) {
            setError('Database not connected — analytics requires a live database');
            setLoading(false);
            return;
        }
        Promise.all([
            getCallbackAnalytics(),
            getSourceConversionRates(),
            getScoreConversionBuckets(),
        ])
            .then(([callbackStats, sources, buckets]) => {
                setStats(callbackStats);
                setSourceRates(sources);
                setScoreBuckets(buckets);
            })
            .catch(err => {
                logger.error('Failed to load analytics', 'AnalyticsPage', err);
                setError(err instanceof Error ? err.message : 'Failed to load analytics');
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
                    Loading analytics...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: 32 }}>
                <div style={{ fontSize: 14, color: 'var(--color-error)', marginBottom: 8 }}>
                    Failed to load analytics: {error}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    Check that the database is reachable and try again.
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div style={{ padding: 32 }}>
                <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                    No analytics data yet. Submit applications and mark callback outcomes to see stats here.
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
                Application Analytics
            </h1>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: 24,
            }}>
                {/* Total Applications - Neutral */}
                <div className="slide-in-left" style={{
                    padding: 24,
                    borderRadius: 12,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                }}>
                    <div style={{
                        fontSize: 13,
                        color: 'var(--color-text-tertiary)',
                        marginBottom: 8,
                        fontWeight: 500,
                        letterSpacing: '0.3px',
                        textTransform: 'uppercase',
                    }}>
                        Total Applications
                    </div>
                    <div style={{
                        fontSize: 36,
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                    }}>
                        {stats.total_applications}
                    </div>
                </div>

                {/* Callbacks Received - Success Green */}
                <div className="slide-in-left" style={{
                    padding: 24,
                    borderRadius: 12,
                    border: '1px solid var(--color-success)',
                    background: 'var(--color-success-container)',
                }}>
                    <div style={{
                        fontSize: 13,
                        color: 'var(--color-text-tertiary)',
                        marginBottom: 8,
                        fontWeight: 500,
                        letterSpacing: '0.3px',
                        textTransform: 'uppercase',
                    }}>
                        Callbacks Received
                    </div>
                    <div style={{
                        fontSize: 36,
                        fontWeight: 600,
                        color: 'var(--color-success)',
                    }}>
                        {stats.total_callbacks}
                    </div>
                </div>

                {/* Callback Rate - Primary Blue */}
                <div className="slide-in-left" style={{
                    padding: 24,
                    borderRadius: 12,
                    border: '1px solid var(--color-primary)',
                    background: 'var(--color-primary-container)',
                }}>
                    <div style={{
                        fontSize: 13,
                        color: 'var(--color-text-tertiary)',
                        marginBottom: 8,
                        fontWeight: 500,
                        letterSpacing: '0.3px',
                        textTransform: 'uppercase',
                    }}>
                        Callback Rate
                    </div>
                    <div style={{
                        fontSize: 36,
                        fontWeight: 600,
                        color: 'var(--color-primary)',
                    }}>
                        {stats.callback_rate.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Source Performance Table */}
            {sourceRates.length > 0 && (
                <div style={{ marginBottom: 32, marginTop: 40 }}>
                    <h2 style={{
                        fontSize: 16,
                        fontWeight: 600,
                        marginBottom: 16,
                        color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                    }}>
                        Source Performance
                    </h2>
                    <div style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: 12,
                        overflow: 'hidden',
                        background: 'var(--color-surface)',
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{
                                    borderBottom: '1px solid var(--color-border)',
                                    background: 'var(--color-surface-raised)',
                                }}>
                                    {['Source', 'Applied', 'Callbacks', 'Rate'].map((label, i) => (
                                        <th key={label} style={{
                                            textAlign: i > 0 ? 'right' : 'left',
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
                                {sourceRates.map(row => (
                                    <tr key={row.source} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <td style={{
                                            padding: '12px 16px',
                                            fontSize: 14,
                                            color: 'var(--color-text-primary)',
                                            fontWeight: 500,
                                        }}>
                                            {row.source}
                                        </td>
                                        <td style={{
                                            padding: '12px 16px',
                                            textAlign: 'right',
                                            fontSize: 14,
                                            color: 'var(--color-text-primary)',
                                        }}>
                                            {row.total}
                                        </td>
                                        <td style={{
                                            padding: '12px 16px',
                                            textAlign: 'right',
                                            fontSize: 14,
                                            color: 'var(--color-text-primary)',
                                        }}>
                                            {row.callbacks}
                                        </td>
                                        <td style={{
                                            padding: '12px 16px',
                                            textAlign: 'right',
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: row.rate >= 10
                                                ? 'var(--color-success)'
                                                : row.rate >= 5
                                                    ? 'var(--color-warning)'
                                                    : 'var(--color-text-primary)',
                                        }}>
                                            {row.rate}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Score vs Callback Rate Table */}
            {scoreBuckets.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                    <h2 style={{
                        fontSize: 16,
                        fontWeight: 600,
                        marginBottom: 4,
                        color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                    }}>
                        Score vs Callback Rate
                    </h2>
                    <div style={{
                        fontSize: 13,
                        color: 'var(--color-text-tertiary)',
                        marginBottom: 16,
                    }}>
                        (requires 50+ applications for significance)
                    </div>
                    <div style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: 12,
                        overflow: 'hidden',
                        background: 'var(--color-surface)',
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{
                                    borderBottom: '1px solid var(--color-border)',
                                    background: 'var(--color-surface-raised)',
                                }}>
                                    {['Score Range', 'Applied', 'Callbacks', 'Rate'].map((label, i) => (
                                        <th key={label} style={{
                                            textAlign: i > 0 ? 'right' : 'left',
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
                                {scoreBuckets.map(row => (
                                    <tr key={row.bucket} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <td style={{
                                            padding: '12px 16px',
                                            fontSize: 14,
                                            color: 'var(--color-text-primary)',
                                            fontWeight: 500,
                                        }}>
                                            {row.bucket}
                                        </td>
                                        <td style={{
                                            padding: '12px 16px',
                                            textAlign: 'right',
                                            fontSize: 14,
                                            color: 'var(--color-text-primary)',
                                        }}>
                                            {row.total}
                                        </td>
                                        <td style={{
                                            padding: '12px 16px',
                                            textAlign: 'right',
                                            fontSize: 14,
                                            color: 'var(--color-text-primary)',
                                        }}>
                                            {row.callbacks}
                                        </td>
                                        <td style={{
                                            padding: '12px 16px',
                                            textAlign: 'right',
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: row.rate >= 10
                                                ? 'var(--color-success)'
                                                : row.rate >= 5
                                                    ? 'var(--color-warning)'
                                                    : 'var(--color-text-primary)',
                                        }}>
                                            {row.rate}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Conditional Guidance - Low Performance Warning */}
            {stats.callback_rate < 5 && stats.total_applications >= 20 && (
                <div className="slide-in-left" style={{
                    marginTop: 32,
                    padding: 16,
                    borderRadius: 8,
                    background: 'var(--color-warning-container)',
                    border: '1px solid var(--color-warning-border)',
                    color: 'var(--color-text-secondary)',
                    fontSize: 14,
                    lineHeight: 1.6,
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                    }}>
                        <div style={{
                            fontSize: 20,
                            lineHeight: 1,
                            marginTop: 2,
                        }}>
                            ⚠️
                        </div>
                        <div>
                            <div style={{
                                fontWeight: 600,
                                color: 'var(--color-warning)',
                                marginBottom: 8,
                            }}>
                                Low callback rate detected
                            </div>
                            <div>Consider improving:</div>
                            <ul style={{
                                marginTop: 8,
                                marginBottom: 0,
                                paddingLeft: 20,
                            }}>
                                <li>Draft message personalization (reference specific company details)</li>
                                <li>Target more relevant roles matching your experience</li>
                                <li>Follow up after 5-7 days if no response</li>
                                <li>Review draft scores - regenerate messages scoring below 70</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Conditional Guidance - Strong Performance */}
            {stats.callback_rate >= 10 && (
                <div className="slide-in-left" style={{
                    marginTop: 32,
                    padding: 16,
                    borderRadius: 8,
                    background: 'var(--color-success-container)',
                    border: '1px solid var(--color-success-border)',
                    color: 'var(--color-text-secondary)',
                    fontSize: 14,
                    lineHeight: 1.6,
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}>
                        <div style={{
                            fontSize: 20,
                            lineHeight: 1,
                        }}>
                            ✓
                        </div>
                        <div>
                            <span style={{
                                fontWeight: 600,
                                color: 'var(--color-success)',
                            }}>
                                Strong callback rate!
                            </span>
                            {' '}
                            Industry average is 5-10%. Your outreach quality is working - keep the momentum going.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
