'use client';

import { useState, useCallback } from 'react';
import CollapsedColumnRail from './CollapsedColumnRail';

interface BaseColumnProps {
    label: string;
    count?: number;
    /** Column body content. Optional when renderItems is provided. */
    children?: React.ReactNode;
    minWidth?: number | string;
    onCollapse?: () => void;
    /** Enable localStorage-backed collapse with pagination */
    collapsible?: boolean;
    /** localStorage key prefix for collapse state (required when collapsible=true) */
    storageKey?: string;
    /** Label for collapsed rail tooltip (e.g. "job" or "contact") */
    itemLabel?: string;
    /** Max items to show before pagination; 0 = show all (default 20) */
    initialLimit?: number;
    /** Total number of items (used for "Show all N" button text) */
    totalItems?: number;
    /** Render function for paginated items — called with the current limit */
    renderItems?: (limit: number, showAll: boolean, onShowAll: () => void) => React.ReactNode;
}

export default function BaseColumn({
    label,
    count,
    children,
    minWidth = 240,
    onCollapse,
    collapsible = false,
    storageKey,
    itemLabel = 'item',
    initialLimit = 20,
    totalItems,
    renderItems,
}: BaseColumnProps) {
    const effectiveStorageKey = storageKey ?? (collapsible ? `col-collapsed-${label}` : null);

    const [collapsed, setCollapsed] = useState(() => {
        if (!collapsible) return false;
        try { return localStorage.getItem(effectiveStorageKey!) !== 'false'; } catch { return true; }
    });

    const [showAll, setShowAll] = useState(false);

    const handleCollapse = useCallback((val: boolean) => {
        setCollapsed(val);
        try { if (effectiveStorageKey) localStorage.setItem(effectiveStorageKey, String(val)); } catch {}
    }, [effectiveStorageKey]);

    const handleShowAll = useCallback(() => setShowAll(true), []);

    // Determine the effective onCollapse handler: explicit prop takes priority,
    // then built-in collapsible behavior.
    const effectiveOnCollapse = onCollapse ?? (collapsible ? () => handleCollapse(true) : undefined);

    if (collapsed && collapsible) {
        return (
            <CollapsedColumnRail
                label={label}
                count={count ?? totalItems ?? 0}
                itemLabel={itemLabel}
                onExpand={() => handleCollapse(false)}
            />
        );
    }

    // Determine body content: use renderItems for pagination, otherwise children
    const bodyContent = renderItems
        ? renderItems(initialLimit, showAll, handleShowAll)
        : children;

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: minWidth,
            height: '100%',
        }}>
            <div
                role={effectiveOnCollapse ? 'button' : undefined}
                tabIndex={effectiveOnCollapse ? 0 : undefined}
                aria-label={effectiveOnCollapse ? `Collapse ${label} column` : undefined}
                onClick={effectiveOnCollapse}
                onKeyDown={effectiveOnCollapse ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); effectiveOnCollapse(); } } : undefined}
                className={effectiveOnCollapse ? 'base-column-header' : undefined}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 8px',
                    marginBottom: 4,
                    cursor: effectiveOnCollapse ? 'pointer' : 'default',
                    borderRadius: 8,
                }}
            >
                <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--color-on-surface-secondary)',
                    flex: 1,
                    userSelect: 'none',
                }}>
                    {label}
                </span>
                {count !== undefined && count > 0 && (
                    <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--color-on-surface-secondary)',
                        background: 'var(--color-outline-variant)',
                        borderRadius: 12,
                        padding: '2px 8px',
                        minWidth: 20,
                        textAlign: 'center',
                    }}>
                        {count}
                    </span>
                )}
                {effectiveOnCollapse && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--color-on-surface-disabled)',
                            padding: '2px 4px',
                        }}
                    >
                        <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </div>
                )}
            </div>

            <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                paddingRight: 6,
                paddingBottom: 20,
            }}>
                {bodyContent}
            </div>
        </div>
    );
}

/** Reusable "Show all N items" button with standard board styling */
export function ShowMoreButton({ total, itemLabel, onClick }: { total: number; itemLabel: string; onClick: () => void }) {
    return (
        <button
            className="show-more-btn"
            onClick={onClick}
            style={{
                width: '100%',
                padding: '12px',
                marginTop: 8,
                background: 'var(--color-surface-container-high)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: 8,
                color: 'var(--color-primary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
            }}
        >
            Show all {total} {itemLabel}{total !== 1 ? 's' : ''}
        </button>
    );
}
