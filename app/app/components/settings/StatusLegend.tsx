'use client';

import { useState } from 'react';

export default function StatusLegend() {
    const [expanded, setExpanded] = useState(false);

    const statusColors = [
        {
            name: 'Ready to Apply',
            color: 'var(--color-primary)',
            states: ['queued', 'review-ready'],
            description: 'Jobs that are ready for you to review and submit. Queued jobs will be auto-filled, review-ready jobs have documents prepared.'
        },
        {
            name: 'Needs Attention',
            color: 'var(--color-warning)',
            states: ['review-incomplete', 'docs-failed'],
            description: 'Jobs that require manual intervention. Either the auto-fill was incomplete or document generation failed.'
        },
        {
            name: 'Failed',
            color: 'var(--color-error)',
            states: ['fill-failed'],
            description: 'Jobs where the auto-fill process completely failed. May require manual application or troubleshooting.'
        },
        {
            name: 'Submitted/Tracking',
            color: 'var(--color-success)',
            states: ['submitted', 'tracking'],
            description: 'Successfully submitted applications. Tracking state means you\'re monitoring for responses.'
        },
        {
            name: 'No Status',
            color: 'transparent',
            states: ['discovered', 'filtered-out', 'rejected'],
            description: 'Jobs in initial discovery, filtered out, or rejected. No action border shown.'
        }
    ];

    return (
        <div style={{
            background: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)',
            borderRadius: 12,
            overflow: 'hidden',
        }}>
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-container-high)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-primary)' }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                    </svg>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-on-surface)' }}>
                            Job Status Colors
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>
                            What the left border colors mean
                        </div>
                    </div>
                </div>
                <span style={{
                    fontSize: 14,
                    color: 'var(--color-on-surface-variant)',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                }}>
                    ▼
                </span>
            </button>

            {/* Expanded content */}
            {expanded && (
                <div style={{
                    padding: '0 16px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    animation: 'fadeIn 0.3s ease-in-out',
                }}>
                    {statusColors.map(status => (
                        <div key={status.name} style={{
                            padding: 12,
                            borderRadius: 8,
                            background: 'var(--color-surface-container-low)',
                            borderLeft: `4px solid ${status.color}`,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: 'var(--color-on-surface)',
                                    letterSpacing: '0.3px',
                                }}>
                                    {status.name}
                                </span>
                            </div>
                            <p style={{
                                fontSize: 12,
                                color: 'var(--color-on-surface-secondary)',
                                lineHeight: 1.5,
                                margin: 0,
                                marginBottom: 6,
                            }}>
                                {status.description}
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {status.states.map(state => (
                                    <span key={state} style={{
                                        fontSize: 10,
                                        fontWeight: 500,
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        background: 'var(--color-surface-raised)',
                                        color: 'var(--color-on-surface-variant)',
                                        letterSpacing: '0.3px',
                                        fontFamily: 'monospace',
                                    }}>
                                        {state}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Additional info */}
                    <div style={{
                        marginTop: 8,
                        padding: 12,
                        borderRadius: 8,
                        background: 'var(--color-info-container)',
                        border: '1px solid var(--color-info)',
                    }}>
                        <div style={{ fontSize: 12, color: 'var(--color-info)', lineHeight: 1.6 }}>
                            <strong>Tip:</strong> The colored left border on each job card indicates its current status in your application pipeline. Focus on jobs with blue borders (ready to apply) and yellow borders (needs attention).
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
