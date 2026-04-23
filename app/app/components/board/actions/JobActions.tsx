'use client';

import { useState, useRef } from 'react';
import type { SidecarEvent } from '@/lib/types';
import ActionMenu from '../../common/ActionMenu';
import type { MenuItemDef } from '../../common/ActionMenu';

export interface JobActionsProps {
    queuedCount: number;
    sessionRunning: boolean;
    sessionResult: SidecarEvent | null;
    scraping: boolean;
    extractingContacts: boolean;
    onStartSession: () => void;
    onScrapeNow: () => void;
    onExtractContacts: () => void;
    onOpenCompanies: () => void;
}

export default function JobActions({
    queuedCount,
    sessionRunning,
    sessionResult,
    scraping,
    extractingContacts,
    onStartSession,
    onScrapeNow,
    onExtractContacts,
    onOpenCompanies,
}: JobActionsProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

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

    const menuItems: MenuItemDef[] = [
        {
            label: scraping ? '◌ Scraping...' : '◉ Scrape Now',
            sublabel: 'Trigger pipeline run',
            disabled: scraping,
            onClick: () => {
                onScrapeNow();
                setMenuOpen(false);
            },
        },
        {
            label: extractingContacts ? '◌ Extracting...' : '◎ Extract Contacts',
            sublabel: 'Mine recruiter emails from job listings',
            disabled: extractingContacts,
            onClick: () => {
                onExtractContacts();
                setMenuOpen(false);
            },
        },
        {
            label: '◫ ATS Watchlist',
            sublabel: 'Companies to poll directly',
            separatorBefore: true,
            onClick: () => {
                onOpenCompanies();
                setMenuOpen(false);
            },
        },
    ];

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

                <ActionMenu
                    items={menuItems}
                    open={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    containerRef={menuRef}
                />
            </div>
        </>
    );
}
