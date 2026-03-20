'use client';

import { useEffect, useRef } from 'react';
import Logo from './Logo';

export interface BoardHeaderProps {
    /** Current search query string */
    searchQuery?: string;
    /** Called when search query changes */
    onSearchChange?: (query: string) => void;
    /** Search placeholder text */
    searchPlaceholder?: string;
    /** Called when the settings gear is clicked */
    onOpenSettings?: () => void;
    /** Toggle control (Jobs/Contacts switcher) */
    toggleContent?: React.ReactNode;
    /** Slot for metrics chips */
    metricsContent?: React.ReactNode;
    /** Slot for action buttons */
    actionsContent?: React.ReactNode;
}

/**
 * Unified header - single 60px row with all controls
 *
 * Layout: [Logo Search] [Toggle] [Metrics] [Actions ⚙]
 *
 * Design: Brutally minimal Material 3 - surgical precision, breathing room
 */
export default function BoardHeader({
    searchQuery = '',
    onSearchChange,
    searchPlaceholder = 'Search…',
    onOpenSettings,
    toggleContent,
    metricsContent,
    actionsContent,
}: BoardHeaderProps) {
    const searchRef = useRef<HTMLInputElement>(null);

    // Ctrl+F focuses the search field
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

    return (
        <nav
            style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(200px, 1fr) auto minmax(200px, 1fr)',
                alignItems: 'center',
                gap: 16,
                minHeight: 60,
                padding: '8px 24px',
                background: 'var(--color-surface-container)',
                borderBottom: '1px solid var(--color-outline-variant)',
                flexShrink: 0,
            }}
        >
            {/* ── Left: Wordmark + Search ─────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                {/* Logo + App wordmark */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Logo size={28} />
                    <span
                        style={{
                            fontSize: 19,
                            fontWeight: 500,
                            color: 'var(--color-on-surface)',
                            letterSpacing: '-0.03em',
                            userSelect: 'none',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Notiapply
                    </span>
                </div>

                {/* Search */}
                {onSearchChange && (
                    <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={e => onSearchChange(e.target.value)}
                            aria-label={searchPlaceholder}
                            style={{
                                width: '100%',
                                height: 36,
                                padding: '0 14px 0 38px',
                                fontSize: 13,
                                fontWeight: 400,
                                borderRadius: 18,
                                border: '1px solid var(--color-outline-variant)',
                                background: 'var(--color-surface-container-low)',
                                color: 'var(--color-on-surface)',
                                outline: 'none',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                            onFocus={e => {
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                                e.currentTarget.style.background = 'var(--color-surface-container)';
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(25, 103, 210, 0.08)';
                            }}
                            onBlur={e => {
                                e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
                                e.currentTarget.style.background = 'var(--color-surface-container-low)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        />
                        {/* Magnifier icon */}
                        <svg
                            width="16" height="16" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round"
                            style={{
                                position: 'absolute', left: 14, top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--color-on-surface-variant)',
                                pointerEvents: 'none',
                            }}
                        >
                            <circle cx="11" cy="11" r="7" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                    </div>
                )}
            </div>

            {/* ── Center: Toggle (Jobs/CRM switcher) ────────────────── */}
            {toggleContent && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {toggleContent}
                </div>
            )}

            {/* ── Right: Metrics + Actions + Settings ────────────────── */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                justifyContent: 'flex-end',
            }}>
                {metricsContent && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {metricsContent}
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {actionsContent}

                    {onOpenSettings && (
                        <button
                            onClick={onOpenSettings}
                            title="Settings"
                            aria-label="Open settings"
                            style={{
                                width: 36, height: 36,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: 'none', borderRadius: 18,
                                background: 'none', cursor: 'pointer',
                                color: 'var(--color-on-surface-variant)',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'var(--color-surface-container-high)';
                                e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'none';
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            {/* Gear icon */}
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
}
