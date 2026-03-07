'use client';

import { useEffect, useRef, useState } from 'react';
import type { SidecarEvent } from '@/lib/types';

interface TopnavProps {
    queuedCount: number;
    incomingCount: number;
    attentionCount: number;
    submittedCount: number;
    totalJobs: number;
    selectedCount: number;
    sessionRunning: boolean;
    sessionResult: SidecarEvent | null;
    scraping: boolean;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onClearSelection: () => void;
    onStartSession: () => void;
    onScrapeNow: () => void;
    onOpenSettings: () => void;
    onOpenCompanies: () => void;
    useMockData: boolean;
}

export default function Topnav({
    queuedCount, incomingCount, attentionCount, submittedCount, totalJobs,
    selectedCount, sessionRunning, sessionResult, scraping, searchQuery, onSearchChange,
    onClearSelection, onStartSession, onScrapeNow, onOpenSettings, onOpenCompanies, useMockData,
}: TopnavProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

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

    // Focus search on Ctrl+F
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
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

    return (
        <nav style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            height: 56, padding: '0 20px',
            background: 'var(--color-surface-container)',
            borderBottom: '1px solid var(--color-outline-variant)',
            position: 'relative',
        }}>
            {/* Wordmark + Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{
                    fontSize: 18,
                    fontWeight: 500,
                    color: 'var(--color-on-surface)',
                    letterSpacing: '-0.02em'
                }}>
                    Notiapply
                </span>

                {/* Search Input */}
                <div style={{ position: 'relative' }}>
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search by title, company, location, or source..."
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                        style={{
                            width: 280,
                            padding: '6px 12px 6px 32px',
                            fontSize: 13,
                            borderRadius: 20,
                            border: '1px solid var(--color-outline-variant)',
                            background: 'var(--color-surface-container-low)',
                            color: 'var(--color-on-surface)',
                            outline: 'none',
                            transition: 'all 0.2s',
                        }}
                        onFocus={e => {
                            e.currentTarget.style.borderColor = 'var(--color-primary)';
                            e.currentTarget.style.background = 'var(--color-surface-container)';
                        }}
                        onBlur={e => {
                            e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
                            e.currentTarget.style.background = 'var(--color-surface-container-low)';
                        }}
                    />
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{
                            position: 'absolute',
                            left: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--color-on-surface-variant)',
                            pointerEvents: 'none',
                        }}
                    >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                </div>
            </div>

            {/* Metrics Dashboard or Selection indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                {selectedCount > 0 ? (
                    <>
                        <span style={{
                            background: 'var(--color-primary-container)',
                            color: 'var(--color-on-primary-container)',
                            padding: '4px 12px',
                            borderRadius: 16,
                            fontWeight: 500,
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
                    <>
                        {/* Metrics Pills */}
                        {incomingCount > 0 && (
                            <MetricPill
                                count={incomingCount}
                                label="incoming"
                                color="var(--color-info)"
                                bgColor="var(--color-info-container)"
                            />
                        )}
                        {queuedCount > 0 && (
                            <MetricPill
                                count={queuedCount}
                                label="queued"
                                color="var(--color-primary)"
                                bgColor="var(--color-primary-container)"
                                pulse
                            />
                        )}
                        {attentionCount > 0 && (
                            <MetricPill
                                count={attentionCount}
                                label="attention"
                                color="var(--color-warning)"
                                bgColor="var(--color-warning-container)"
                            />
                        )}
                        {submittedCount > 0 && (
                            <MetricPill
                                count={submittedCount}
                                label="submitted"
                                color="var(--color-success)"
                                bgColor="var(--color-success-container)"
                            />
                        )}
                        {totalJobs > 0 && (
                            <span style={{
                                color: 'var(--color-on-surface-variant)',
                                fontSize: 12,
                                fontWeight: 500,
                                marginLeft: 4,
                            }}>
                                {totalJobs} total{useMockData && ' (MOCK DATA)'}
                            </span>
                        )}
                    </>
                )}
            </div>

            {/* Right controls */}
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

                {/* overflow menu */}
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
                                label="* Settings"
                                sublabel="LLM, search, notifications"
                                onClick={() => { onOpenSettings(); setMenuOpen(false); }}
                            />
                            <MenuItem
                                label="◫ ATS Watchlist"
                                sublabel="Companies to poll directly"
                                onClick={() => { onOpenCompanies(); setMenuOpen(false); }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}

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

function MetricPill({ count, label, color, bgColor, pulse = false }: {
    count: number;
    label: string;
    color: string;
    bgColor: string;
    pulse?: boolean;
}) {
    return (
        <span style={{
            background: bgColor,
            color,
            padding: '4px 12px',
            borderRadius: 16,
            fontWeight: 500,
            fontSize: 12,
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
            animation: pulse ? 'scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        }}>
            {count} {label}
        </span>
    );
}
