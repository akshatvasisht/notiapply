'use client';

import { useEffect, useRef, useState } from 'react';
import type { SidecarEvent } from '@/lib/types';

interface TopnavProps {
    queuedCount: number;
    sessionRunning: boolean;
    sessionResult: SidecarEvent | null;
    scraping: boolean;
    onStartSession: () => void;
    onScrapeNow: () => void;
    onOpenSettings: () => void;
    onOpenCompanies: () => void;
}

export default function Topnav({
    queuedCount, sessionRunning, sessionResult, scraping,
    onStartSession, onScrapeNow, onOpenSettings, onOpenCompanies,
}: TopnavProps) {
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

    let sessionBtnStyle: React.CSSProperties;
    let sessionBtnText: string;

    if (sessionResult && !sessionRunning) {
        sessionBtnStyle = { background: 'var(--color-google-green)', color: 'var(--color-text-inverse)' };
        sessionBtnText = '✓ Done';
    } else if (sessionRunning) {
        sessionBtnStyle = { background: 'var(--color-google-yellow)', color: '#202124' };
        sessionBtnText = '● Filling…';
    } else if (queuedCount > 0) {
        sessionBtnStyle = { background: 'var(--color-google-blue)', color: 'var(--color-text-inverse)' };
        sessionBtnText = '▶ Start Session';
    } else {
        sessionBtnStyle = { background: 'transparent', color: 'var(--color-google-blue)', border: '1px solid var(--color-google-blue)' };
        sessionBtnText = '▶ Start Session';
    }

    return (
        <nav style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            height: 44, padding: '0 16px',
            background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
            position: 'relative',
        }}>
            {/* Wordmark */}
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
                Notiapply
            </span>

            {/* Queue pill */}
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {queuedCount > 0 && (
                    <span style={{
                        background: 'var(--color-blue-tint)', color: 'var(--color-google-blue)',
                        padding: '2px 8px', borderRadius: 10, fontWeight: 500,
                    }}>
                        {queuedCount} queued
                    </span>
                )}
            </span>

            {/* Right controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                    onClick={onStartSession}
                    disabled={sessionRunning}
                    style={{
                        padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                        cursor: sessionRunning ? 'not-allowed' : 'pointer', border: 'none',
                        transition: 'all 0.2s', ...sessionBtnStyle,
                    }}
                >
                    {sessionBtnText}
                </button>

                {/* ··· overflow menu */}
                <div ref={menuRef} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setMenuOpen(o => !o)}
                        style={{
                            background: menuOpen ? 'var(--color-surface-raised)' : 'none',
                            border: '1px solid transparent',
                            borderColor: menuOpen ? 'var(--color-border)' : 'transparent',
                            borderRadius: 6, cursor: 'pointer', fontSize: 16,
                            color: 'var(--color-text-secondary)', padding: '4px 10px',
                            transition: 'all 0.15s',
                        }}
                        aria-label="More options"
                    >
                        ···
                    </button>

                    {menuOpen && (
                        <div style={{
                            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
                            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                            borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                            minWidth: 180, overflow: 'hidden', padding: '4px 0',
                        }}>
                            <MenuItem
                                label={scraping ? '⟳ Scraping…' : '⟳ Scrape Now'}
                                sublabel="Trigger pipeline run"
                                disabled={scraping}
                                onClick={() => { onScrapeNow(); setMenuOpen(false); }}
                            />
                            <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                            <MenuItem
                                label="⚙ Settings"
                                sublabel="LLM, search, notifications"
                                onClick={() => { onOpenSettings(); setMenuOpen(false); }}
                            />
                            <MenuItem
                                label="🏢 ATS Watchlist"
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
                width: '100%', padding: '8px 14px', border: 'none', cursor: disabled ? 'default' : 'pointer',
                background: hovered && !disabled ? 'var(--color-surface-raised)' : 'transparent',
                opacity: disabled ? 0.5 : 1, transition: 'background 0.1s', textAlign: 'left',
            }}
        >
            <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>{label}</span>
            {sublabel && <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{sublabel}</span>}
        </button>
    );
}
