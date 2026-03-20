'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { getCallbackAnalytics } from '@/lib/db';
import type { CallbackStats } from '@/lib/types';

export default function AnalyticsPage() {
    const [stats, setStats] = useState<CallbackStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getCallbackAnalytics()
            .then(setStats)
            .catch(err => {
                logger.error('Failed to load analytics', 'AnalyticsPage', err);
                setStats(null);
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

    if (!stats) {
        return (
            <div style={{ padding: 32 }}>
                <div style={{
                    fontSize: 14,
                    color: 'var(--color-text-secondary)',
                }}>
                    No data available
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: 32 }}>
            <style>{`
                @keyframes slideInLeft {
                    from {
                        opacity: 0;
                        transform: translateX(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
            `}</style>

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
                <div style={{
                    padding: 24,
                    borderRadius: 12,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    animation: 'slideInLeft 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
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
                <div style={{
                    padding: 24,
                    borderRadius: 12,
                    border: '1px solid var(--color-success)',
                    background: 'var(--color-success-container)',
                    animation: 'slideInLeft 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
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
                <div style={{
                    padding: 24,
                    borderRadius: 12,
                    border: '1px solid var(--color-primary)',
                    background: 'var(--color-primary-container)',
                    animation: 'slideInLeft 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
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

            {/* Conditional Guidance - Low Performance Warning */}
            {stats.callback_rate < 5 && stats.total_applications >= 20 && (
                <div style={{
                    marginTop: 32,
                    padding: 16,
                    borderRadius: 8,
                    background: 'var(--color-warning-container)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    color: 'var(--color-text-secondary)',
                    fontSize: 14,
                    lineHeight: 1.6,
                    animation: 'slideInLeft 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
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
                <div style={{
                    marginTop: 32,
                    padding: 16,
                    borderRadius: 8,
                    background: 'var(--color-success-container)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: 'var(--color-text-secondary)',
                    fontSize: 14,
                    lineHeight: 1.6,
                    animation: 'slideInLeft 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
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
