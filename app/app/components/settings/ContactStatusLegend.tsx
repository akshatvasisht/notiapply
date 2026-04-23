'use client';

import { useState } from 'react';

export default function ContactStatusLegend() {
    const [expanded, setExpanded] = useState(false);

    const statusColors = [
        {
            name: 'Drafting',
            color: 'var(--color-primary)',
            states: ['drafted'],
            description: 'Ready to go. A message has been drafted and is awaiting your final review/send.'
        },
        {
            name: 'Reached Out',
            color: 'var(--color-warning)',
            states: ['contacted'],
            description: 'In-flight. You have sent the initial message and are waiting for a response.'
        },
        {
            name: 'Engaged',
            color: 'var(--color-success)',
            states: ['replied', 'interviewing'],
            description: 'Positive progression. They have replied or you are actively interviewing.'
        },
        {
            name: 'No Status',
            color: 'transparent',
            states: ['identified', 'rejected'],
            description: 'Initial discovery or closed prospects. No action border shown.'
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
                }}
                className="legend-header-btn"
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-primary)' }}>
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-on-surface)' }}>
                            CRM Status Colors
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>
                            Spatial parity with the Job Pipeline
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
                </div>
            )}
        </div>
    );
}
