'use client';

import { useState } from 'react';
import { SOURCE_CATEGORIES } from '@/lib/types';

export default function SourceLegend() {
    const [expanded, setExpanded] = useState(false);

    const colorMap: Record<string, string> = {
        primary: 'var(--color-primary)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        secondary: 'var(--color-secondary)',
    };

    const bgColorMap: Record<string, string> = {
        primary: 'var(--color-primary-container)',
        success: 'var(--color-success-container)',
        warning: 'var(--color-warning-container)',
        secondary: 'var(--color-secondary-container)',
    };

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
                        <circle cx="12" cy="12" r="3" />
                        <circle cx="12" cy="4" r="2" />
                        <circle cx="12" cy="20" r="2" />
                        <circle cx="4" cy="12" r="2" />
                        <circle cx="20" cy="12" r="2" />
                    </svg>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-on-surface)' }}>
                            Source Tag Colors
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>
                            What the colored tags mean
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
                    {Object.entries(SOURCE_CATEGORIES).map(([key, category]) => (
                        <div key={key} style={{
                            padding: 12,
                            borderRadius: 8,
                            background: 'var(--color-surface-container-low)',
                            border: `1px solid ${bgColorMap[category.color]}`,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <div style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: colorMap[category.color],
                                }} />
                                <span style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: 'var(--color-on-surface)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                }}>
                                    {category.name}
                                </span>
                            </div>
                            <p style={{
                                fontSize: 12,
                                color: 'var(--color-on-surface-secondary)',
                                lineHeight: 1.5,
                                margin: 0,
                                marginBottom: 8,
                            }}>
                                {category.description}
                            </p>
                            {'quality' in category && (
                                <div style={{
                                    fontSize: 11,
                                    color: 'var(--color-on-surface-variant)',
                                    marginBottom: 4,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 2,
                                }}>
                                    <div><strong>Quality:</strong> {category.quality}</div>
                                    <div><strong>Update Frequency:</strong> {category.speed}</div>
                                </div>
                            )}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                {category.sources.map(source => {
                                    const label = source.split('-').pop()?.replace('jobspy-', '');
                                    return (
                                        <span key={source} style={{
                                            fontSize: 11,
                                            fontWeight: 500,
                                            padding: '3px 8px',
                                            borderRadius: 8,
                                            background: bgColorMap[category.color],
                                            color: colorMap[category.color],
                                            letterSpacing: '0.3px',
                                        }}>
                                            {label}
                                        </span>
                                    );
                                })}
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
                            <strong>Recommendation:</strong> Prioritize <strong style={{ color: colorMap.success }}>Company ATS</strong> sources for best data quality and fastest response times. Use <strong style={{ color: colorMap.primary }}>Aggregators</strong> for broad coverage when exploring options. <strong style={{ color: colorMap.warning }}>Curated</strong> lists are great for new grads but expect competition. <strong style={{ color: colorMap.secondary }}>Startup</strong> platforms offer equity upside but higher uncertainty.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
