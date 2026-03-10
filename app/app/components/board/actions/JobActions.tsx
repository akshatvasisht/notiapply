'use client';

import { useState, useEffect, useRef } from 'react';
import type { SidecarEvent } from '@/lib/types';

export interface JobActionsProps {
    queuedCount: number;
    sessionRunning: boolean;
    sessionResult: SidecarEvent | null;
    scraping: boolean;
    onStartSession: () => void;
    onScrapeNow: () => void;
    onOpenCompanies: () => void;
}

export default function JobActions({
    queuedCount,
    sessionRunning,
    sessionResult,
    scraping,
    onStartSession,
    onScrapeNow,
    onOpenCompanies,
}: JobActionsProps) {
    const [menuOpen, setMenuOpen] = useState(false);
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

    // Session button styling based on state
    let sessionBtnStyle: React.CSSProperties;
    let sessionBtnText: string;

    if (sessionResult && !sessionRunning) {
        sessionBtnStyle = {
            background: 'var(--color-success)',
            color: 'var(--color-on-primary)',
            boxShadow: 'var(--elevation-1)',
        };
        sessionBtnText = 'Done';
    } else if (sessionRunning) {
        sessionBtnStyle = {
            background: 'var(--color-warning-container)',
            color: 'var(--color-on-surface)',
            boxShadow: 'var(--elevation-1)',
            animation: 'shimmer 1.5s ease-in-out infinite',
        };
        sessionBtnText = '◌ Filling...';
    } else if (queuedCount > 0) {
        sessionBtnStyle = {
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            boxShadow: 'var(--elevation-1)',
        };
        sessionBtnText = '▸ Start Session';
    } else {
        sessionBtnStyle = {
            background: 'transparent',
            color: 'var(--color-primary)',
            border: '1px solid var(--color-outline)',
        };
        sessionBtnText = '▸ Start Session';
    }

    return (
        <>
            {/* Primary action: Start Session */}
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
                    onClick={() => setMenuOpen((o) => !o)}
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
                    <div
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            right: 0,
                            zIndex: 50,
                            background: 'var(--color-surface-container-high)',
                            border: 'none',
                            borderRadius: 16,
                            boxShadow: 'var(--elevation-3)',
                            minWidth: 220,
                            overflow: 'hidden',
                            padding: '8px 0',
                            animation: 'scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                    >
                        <MenuItem
                            label={scraping ? '◌ Scraping...' : '◉ Scrape Now'}
                            sublabel="Trigger pipeline run"
                            disabled={scraping}
                            onClick={() => {
                                onScrapeNow();
                                setMenuOpen(false);
                            }}
                        />
                        <div style={{ height: 1, background: 'var(--color-outline-variant)', margin: '8px 0' }} />
                        <MenuItem
                            label="◫ ATS Watchlist"
                            sublabel="Companies to poll directly"
                            onClick={() => {
                                onOpenCompanies();
                                setMenuOpen(false);
                            }}
                        />
                    </div>
                )}
            </div>
        </>
    );
}

// ─── Menu Item ──────────────────────────────────────────────────────────────

function MenuItem({
    label,
    sublabel,
    onClick,
    disabled = false,
}: {
    label: string;
    sublabel?: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                cursor: disabled ? 'default' : 'pointer',
                background: hovered && !disabled ? 'var(--color-secondary-container)' : 'transparent',
                opacity: disabled ? 0.5 : 1,
                transition: 'background 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                textAlign: 'left',
            }}
        >
            <span
                style={{
                    fontSize: 14,
                    color: 'var(--color-on-surface)',
                    fontWeight: 500,
                    letterSpacing: '0.1px',
                }}
            >
                {label}
            </span>
            {sublabel && (
                <span
                    style={{
                        fontSize: 12,
                        color: 'var(--color-on-surface-variant)',
                        marginTop: 2,
                        letterSpacing: '0.4px',
                    }}
                >
                    {sublabel}
                </span>
            )}
        </button>
    );
}
