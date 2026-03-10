'use client';

import { useEffect, useRef } from 'react';

export interface BoardHeaderProps {
    /** Current search query string */
    searchQuery?: string;
    /** Called when search query changes */
    onSearchChange?: (query: string) => void;
    /** Search placeholder text */
    searchPlaceholder?: string;
    /** Called when the settings gear is clicked */
    onOpenSettings?: () => void;
    /** Slot for center-area content (e.g. metrics chips on Jobs board) */
    centerContent?: React.ReactNode;
    /** Slot for right-side content (e.g. action buttons) */
    rightContent?: React.ReactNode;
}

/**
 * Shared top-level header that gives both boards a unified identity.
 *
 * Layout:  [Wordmark  Search]  [centerContent]  [rightContent  ⚙]
 */
export default function BoardHeader({
    searchQuery = '',
    onSearchChange,
    searchPlaceholder = 'Search…',
    onOpenSettings,
    centerContent,
    rightContent,
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: 56,
                padding: '0 20px',
                background: 'var(--color-surface-container)',
                borderBottom: '1px solid var(--color-outline-variant)',
                flexShrink: 0,
                position: 'relative',
                zIndex: 10,
            }}
        >
            {/* ── Left: Wordmark + Search ───────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* App wordmark */}
                <span
                    style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: 'var(--color-on-surface)',
                        letterSpacing: '-0.02em',
                        userSelect: 'none',
                    }}
                >
                    Notiapply
                </span>

                {/* Search – only rendered when a change handler is provided */}
                {onSearchChange && (
                    <div style={{ position: 'relative' }}>
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder={searchPlaceholder}
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
                                transition: 'border-color 0.15s, background 0.15s',
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
                        {/* Magnifier icon */}
                        <svg
                            width="16" height="16" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2"
                            style={{
                                position: 'absolute', left: 10, top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--color-on-surface-variant)',
                                pointerEvents: 'none',
                            }}
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                    </div>
                )}
            </div>

            {/* ── Center: caller-injected content (metrics, chips, etc.) ── */}
            {centerContent && (
                <div
                    style={{
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    {centerContent}
                </div>
            )}

            {/* ── Right: caller-injected actions + settings gear ─────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {rightContent}

                {onOpenSettings && (
                    <button
                        onClick={onOpenSettings}
                        title="Settings"
                        style={{
                            width: 36, height: 36,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: 'none', borderRadius: 18,
                            background: 'none', cursor: 'pointer',
                            color: 'var(--color-on-surface-variant)',
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-container-high)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                        {/* Gear icon */}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </button>
                )}
            </div>
        </nav>
    );
}
