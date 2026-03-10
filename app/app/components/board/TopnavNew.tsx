'use client';

import { useEffect, useRef, useState } from 'react';
import type { SidecarEvent, ATSFailure, AutomationStats, SourceCoverage } from '@/lib/types';

// TopnavNew – metrics + action bar only.
// App wordmark, search, and settings live in BoardHeader above this.

interface TopnavProps {
    queuedCount: number;
    atsFailures: ATSFailure[];
    automationStats: AutomationStats;
    lastScrapeTime: Date | null;
    sourceCoverage: SourceCoverage;
    selectedCount: number;
    sessionRunning: boolean;
    sessionResult: SidecarEvent | null;
    scraping: boolean;
    onClearSelection: () => void;
    onStartSession: () => void;
    onScrapeNow: () => void;
    onOpenCompanies: () => void;
}

export default function Topnav({
    queuedCount, atsFailures, automationStats, lastScrapeTime, sourceCoverage,
    selectedCount, sessionRunning, sessionResult, scraping,
    onClearSelection, onStartSession, onScrapeNow, onOpenCompanies,
}: TopnavProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [metricModal, setMetricModal] = useState<'ats' | 'automation' | 'scrape' | 'sources' | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    let sessionBtnStyle: React.CSSProperties;
    let sessionBtnText: string;

    if (sessionResult && !sessionRunning) {
        sessionBtnStyle = {
            background: 'var(--color-success)',
            color: 'var(--color-on-primary)',
            boxShadow: 'var(--elevation-1)'
        };
        sessionBtnText = 'Done';
    } else if (sessionRunning) {
        sessionBtnStyle = {
            background: 'var(--color-warning-container)',
            color: 'var(--color-on-surface)',
            boxShadow: 'var(--elevation-1)',
            animation: 'shimmer 1.5s ease-in-out infinite'
        };
        sessionBtnText = '◌ Filling...';
    } else if (queuedCount > 0) {
        sessionBtnStyle = {
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            boxShadow: 'var(--elevation-1)'
        };
        sessionBtnText = '▸ Start Session';
    } else {
        sessionBtnStyle = {
            background: 'transparent',
            color: 'var(--color-primary)',
            border: '1px solid var(--color-outline)'
        };
        sessionBtnText = '▸ Start Session';
    }

    // Calculate time since last scrape
    const getTimeSinceLastScrape = () => {
        if (!lastScrapeTime) return null;
        const now = new Date();
        const diff = now.getTime() - lastScrapeTime.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours === 0) return `${minutes}m ago`;
        return `${hours}h ago`;
    };

    const timeSince = getTimeSinceLastScrape();
    const isStale = lastScrapeTime && (new Date().getTime() - lastScrapeTime.getTime()) > 12 * 60 * 60 * 1000;
    const totalFailures = atsFailures.reduce((sum, f) => sum + f.fill_failed_count, 0);

    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            height: 44, padding: '0 20px',
            background: 'var(--color-surface-container)',
            borderBottom: '1px solid var(--color-outline-variant)',
            position: 'relative',
            flexShrink: 0,
        }}>
            {/* Center: Metrics Dashboard - Dynamically Centered */}
            <div style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
            }}>
                {selectedCount > 0 ? (
                    // Selection mode
                    <>
                        <span style={{
                            background: 'var(--color-primary-container)',
                            color: 'var(--color-on-primary-container)',
                            padding: '4px 12px',
                            borderRadius: 16,
                            fontWeight: 500,
                            fontSize: 12,
                        }}>
                            {selectedCount} selected
                        </span>
                        <button
                            onClick={onClearSelection}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 13,
                                color: 'var(--color-on-surface-variant)',
                                textDecoration: 'underline',
                            }}
                        >
                            Clear
                        </button>
                    </>
                ) : (
                    // Metrics dashboard
                    <>
                        {/* ATS Failures */}
                        {totalFailures > 0 && (
                            <ClickableMetricPill
                                onClick={() => setMetricModal('ats')}
                                tooltip="Click to see detailed ATS failure breakdown"
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <WarningIcon color="var(--color-error)" />
                                    <MetricValue color="var(--color-error)">{totalFailures} ATS failure{totalFailures > 1 ? 's' : ''}</MetricValue>
                                </div>
                                {atsFailures.length > 0 && (
                                    <MetricLabel>{atsFailures[0].ats_platform}: {atsFailures[0].fill_failed_count}</MetricLabel>
                                )}
                            </ClickableMetricPill>
                        )}

                        {/* Automation Success Rate */}
                        {automationStats.total > 0 && (
                            <ClickableMetricPill
                                onClick={() => setMetricModal('automation')}
                                tooltip={`${automationStats.automated} auto-filled out of ${automationStats.total} attempted`}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <ProgressBar rate={automationStats.rate} />
                                    <MetricValue color={automationStats.rate >= 70 ? 'var(--color-success)' : 'var(--color-warning)'}>
                                        {automationStats.rate}%
                                    </MetricValue>
                                </div>
                                <MetricLabel>Auto-filled</MetricLabel>
                            </ClickableMetricPill>
                        )}

                        {/* Last Scrape Time */}
                        {timeSince && (
                            <ClickableMetricPill
                                onClick={() => setMetricModal('scrape')}
                                tooltip={`Last scrape: ${lastScrapeTime?.toLocaleString()}${isStale ? ' (Stale - consider running scraper)' : ''}`}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <ClockIcon color={isStale ? 'var(--color-warning)' : 'var(--color-on-surface-secondary)'} />
                                    <MetricValue color={isStale ? 'var(--color-warning)' : 'var(--color-on-surface)'}>
                                        {timeSince}
                                    </MetricValue>
                                </div>
                                <MetricLabel>Last scrape</MetricLabel>
                            </ClickableMetricPill>
                        )}

                        {/* Source Coverage */}
                        <ClickableMetricPill
                            onClick={() => setMetricModal('sources')}
                            tooltip={`${sourceCoverage.active} of ${sourceCoverage.total} job board scrapers are enabled`}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <SourceBars active={sourceCoverage.active} total={sourceCoverage.total} />
                                <MetricValue>
                                    {sourceCoverage.active}/{sourceCoverage.total}
                                </MetricValue>
                            </div>
                            <MetricLabel>Sources active</MetricLabel>
                        </ClickableMetricPill>
                    </>
                )}
            </div>

            {/* Right: Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                    onClick={onStartSession}
                    disabled={sessionRunning}
                    style={{
                        padding: '8px 18px',
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 500,
                        letterSpacing: '0.5px',
                        cursor: sessionRunning ? 'not-allowed' : 'pointer',
                        border: 'none',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        ...sessionBtnStyle,
                    }}
                >
                    {sessionBtnText}
                </button>

                {/* Overflow menu */}
                <div ref={menuRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setMenuOpen(o => !o)}
                        style={{
                            background: menuOpen ? 'var(--color-secondary-container)' : 'transparent',
                            border: 'none',
                            borderRadius: 20,
                            cursor: 'pointer',
                            fontSize: 20,
                            color: 'var(--color-on-surface-variant)',
                            padding: '6px 12px',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            lineHeight: 1,
                        }}
                        aria-label="More options"
                    >
                        ⋮
                    </button>

                    {menuOpen && (
                        <div style={{
                            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50,
                            background: 'var(--color-surface-container-high)',
                            border: 'none',
                            borderRadius: 16,
                            boxShadow: 'var(--elevation-3)',
                            minWidth: 220,
                            overflow: 'hidden',
                            padding: '8px 0',
                            animation: 'scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                            <MenuItem
                                label={scraping ? '◌ Scraping...' : '◉ Scrape Now'}
                                sublabel="Trigger pipeline run"
                                disabled={scraping}
                                onClick={() => { onScrapeNow(); setMenuOpen(false); }}
                            />
                            <div style={{ height: 1, background: 'var(--color-outline-variant)', margin: '8px 0' }} />
                            <MenuItem
                                label="◫ ATS Watchlist"
                                sublabel="Companies to poll directly"
                                onClick={() => { onOpenCompanies(); setMenuOpen(false); }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Metric Detail Modals */}
            {metricModal === 'ats' && (
                <MetricModal title="ATS Failures" onClose={() => setMetricModal(null)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <p style={{ fontSize: 14, color: 'var(--color-on-surface-variant)', margin: 0 }}>
                            These platforms had issues during auto-fill attempts. Review jobs to identify patterns.
                        </p>
                        {atsFailures.map((failure, i) => (
                            <div key={i} style={{
                                padding: 16,
                                borderRadius: 12,
                                background: 'var(--color-error-container)',
                                border: '1px solid var(--color-outline-variant)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-on-error-container)' }}>
                                        {failure.ats_platform}
                                    </span>
                                    <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
                                        Last updated: {new Date(failure.last_updated).toLocaleString()}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 24 }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginBottom: 4 }}>
                                            Fill Failed
                                        </div>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-error)' }}>
                                            {failure.fill_failed_count}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginBottom: 4 }}>
                                            Review Incomplete
                                        </div>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-warning)' }}>
                                            {failure.review_incomplete_count}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </MetricModal>
            )}

            {metricModal === 'automation' && (
                <MetricModal title="Auto-Fill Success Rate" onClose={() => setMetricModal(null)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <p style={{ fontSize: 14, color: 'var(--color-on-surface-variant)', margin: 0 }}>
                            Percentage of jobs that were successfully auto-filled and moved to review-ready, submitted, or tracking states.
                        </p>
                        <div style={{
                            padding: 24,
                            borderRadius: 12,
                            background: 'var(--color-primary-container)',
                            textAlign: 'center',
                        }}>
                            <div style={{ fontSize: 48, fontWeight: 700, color: automationStats.rate >= 70 ? 'var(--color-success)' : 'var(--color-warning)', marginBottom: 8 }}>
                                {automationStats.rate}%
                            </div>
                            <div style={{ fontSize: 14, color: 'var(--color-on-surface-variant)' }}>
                                {automationStats.automated} auto-filled out of {automationStats.total} attempted
                            </div>
                        </div>
                        <div style={{
                            padding: 16,
                            borderRadius: 8,
                            background: 'var(--color-surface-container)',
                            fontSize: 13,
                            color: 'var(--color-on-surface-variant)',
                        }}>
                            <strong>Note:</strong> Excludes jobs in &apos;filtered-out&apos;, &apos;rejected&apos;, or &apos;discovered&apos; states.
                        </div>
                    </div>
                </MetricModal>
            )}

            {metricModal === 'scrape' && (
                <MetricModal title="Scraping Status" onClose={() => setMetricModal(null)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <p style={{ fontSize: 14, color: 'var(--color-on-surface-variant)', margin: 0 }}>
                            Monitor when the scraping pipeline last ran to ensure fresh job postings.
                        </p>
                        <div style={{
                            padding: 24,
                            borderRadius: 12,
                            background: isStale ? 'var(--color-warning-container)' : 'var(--color-surface-container)',
                            textAlign: 'center',
                        }}>
                            <div style={{ fontSize: 14, color: 'var(--color-on-surface-variant)', marginBottom: 8 }}>
                                Last Scrape
                            </div>
                            <div style={{ fontSize: 32, fontWeight: 700, color: isStale ? 'var(--color-warning)' : 'var(--color-on-surface)', marginBottom: 4 }}>
                                {timeSince}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--color-on-surface-variant)' }}>
                                {lastScrapeTime?.toLocaleString()}
                            </div>
                        </div>
                        {isStale && (
                            <div style={{
                                padding: 16,
                                borderRadius: 8,
                                background: 'var(--color-error-container)',
                                fontSize: 13,
                                color: 'var(--color-on-error-container)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}>
                                <WarningIcon color="var(--color-error)" />
                                <span><strong>Warning:</strong> Last scrape was over 12 hours ago. Consider running the scraper.</span>
                            </div>
                        )}
                    </div>
                </MetricModal>
            )}

            {metricModal === 'sources' && (
                <MetricModal title="Source Coverage" onClose={() => setMetricModal(null)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <p style={{ fontSize: 14, color: 'var(--color-on-surface-variant)', margin: 0 }}>
                            Built-in job board scrapers (Tier 1-4). Enable sources in Settings to increase coverage.
                        </p>
                        <div style={{
                            padding: 24,
                            borderRadius: 12,
                            background: 'var(--color-surface-container)',
                            textAlign: 'center',
                        }}>
                            <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 8 }}>
                                {sourceCoverage.active}/{sourceCoverage.total}
                            </div>
                            <div style={{ fontSize: 14, color: 'var(--color-on-surface-variant)' }}>
                                Active scrapers
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {['Tier 1: LinkedIn', 'Tier 2: Indeed', 'Tier 3: Glassdoor', 'Tier 4: ZipRecruiter'].map((tier, i) => (
                                <div key={i} style={{
                                    padding: 12,
                                    borderRadius: 8,
                                    background: i < sourceCoverage.active ? 'var(--color-primary-container)' : 'var(--color-surface-container-low)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}>
                                    <span style={{ fontSize: 14, color: 'var(--color-on-surface)' }}>{tier}</span>
                                    <span style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: i < sourceCoverage.active ? 'var(--color-success)' : 'var(--color-on-surface-variant)',
                                    }}>
                                        {i < sourceCoverage.active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </MetricModal>
            )}
        </div>
    );
}

// ─── Metric Components ──────────────────────────────────────────────────────────

function ClickableMetricPill({ children, onClick, tooltip }: { children: React.ReactNode; onClick: () => void; tooltip: string }) {
    const [hovered, setHovered] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={onClick}
                onMouseEnter={() => { setHovered(true); setShowTooltip(true); }}
                onMouseLeave={() => { setHovered(false); setShowTooltip(false); }}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2,
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: hovered ? 'var(--color-surface-container-high)' : 'var(--color-surface-container)',
                    border: '1px solid var(--color-outline-variant)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    transform: hovered ? 'translateY(-1px)' : 'none',
                    boxShadow: hovered ? 'var(--elevation-1)' : 'none',
                }}
            >
                {children}
            </button>
            {showTooltip && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--color-inverse-surface)',
                    color: 'var(--color-inverse-on-surface)',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                    boxShadow: 'var(--elevation-2)',
                    zIndex: 100,
                    pointerEvents: 'none',
                    animation: 'fadeIn 0.2s ease-in-out',
                }}>
                    {tooltip}
                    <div style={{
                        position: 'absolute',
                        top: -4,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0,
                        height: 0,
                        borderLeft: '4px solid transparent',
                        borderRight: '4px solid transparent',
                        borderBottom: '4px solid var(--color-inverse-surface)',
                    }} />
                </div>
            )}
        </div>
    );
}

function MetricValue({ children, color = 'var(--color-on-surface)' }: { children: React.ReactNode; color?: string }) {
    return (
        <div style={{
            fontSize: 14,
            fontWeight: 600,
            color,
            letterSpacing: '-0.01em',
            lineHeight: 1,
        }}>
            {children}
        </div>
    );
}

function MetricLabel({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--color-on-surface-variant)',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            lineHeight: 1,
        }}>
            {children}
        </div>
    );
}

// ─── SVG Icons & Visualizations ────────────────────────────────────────────────

function WarningIcon({ color }: { color: string }) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill={color}>
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
        </svg>
    );
}

function ClockIcon({ color }: { color: string }) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
            <circle cx="12" cy="12" r="10" opacity="0.3" />
            <polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function ProgressBar({ rate }: { rate: number }) {
    return (
        <svg width="60" height="8" style={{ borderRadius: 4 }}>
            <rect width="60" height="8" fill="var(--color-outline-variant)" rx="4" />
            <rect width={rate * 0.6} height="8" fill={rate >= 70 ? 'var(--color-success)' : 'var(--color-warning)'} rx="4">
                <animate attributeName="width" from="0" to={rate * 0.6} dur="0.6s" fill="freeze" />
            </rect>
        </svg>
    );
}

function SourceBars({ active, total }: { active: number; total: number }) {
    const colors = ['var(--color-primary)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-error)'];

    return (
        <svg width="32" height="16" viewBox="0 0 32 16">
            {Array.from({ length: total }).map((_, i) => (
                <rect
                    key={i}
                    x={i * 9}
                    y="0"
                    width="6"
                    height="16"
                    fill={colors[i]}
                    opacity={i < active ? 1 : 0.2}
                    rx="2"
                />
            ))}
        </svg>
    );
}

// ─── Menu Item ──────────────────────────────────────────────────────────────────

function MenuItem({ label, sublabel, onClick, disabled = false }: {
    label: string; sublabel?: string; onClick: () => void; disabled?: boolean;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                width: '100%', padding: '10px 16px', border: 'none', cursor: disabled ? 'default' : 'pointer',
                background: hovered && !disabled ? 'var(--color-secondary-container)' : 'transparent',
                opacity: disabled ? 0.5 : 1,
                transition: 'background 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                textAlign: 'left',
            }}
        >
            <span style={{
                fontSize: 14,
                color: 'var(--color-on-surface)',
                fontWeight: 500,
                letterSpacing: '0.1px'
            }}>
                {label}
            </span>
            {sublabel && (
                <span style={{
                    fontSize: 12,
                    color: 'var(--color-on-surface-variant)',
                    marginTop: 2,
                    letterSpacing: '0.4px'
                }}>
                    {sublabel}
                </span>
            )}
        </button>
    );
}

// ─── Metric Modal ───────────────────────────────────────────────────────────────

function MetricModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                animation: 'fadeIn 0.2s ease-in-out',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--color-surface-container)',
                    borderRadius: 16,
                    padding: 24,
                    maxWidth: 600,
                    width: '90%',
                    maxHeight: '80vh',
                    overflow: 'auto',
                    boxShadow: 'var(--elevation-3)',
                    animation: 'scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--color-on-surface)' }}>
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            fontSize: 24,
                            cursor: 'pointer',
                            color: 'var(--color-on-surface-variant)',
                            padding: '4px 8px',
                            borderRadius: 8,
                            transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-container-high)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        ×
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
