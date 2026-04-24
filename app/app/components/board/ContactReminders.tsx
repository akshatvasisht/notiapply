'use client';

import React, { memo, useEffect, useMemo, useState } from 'react';
import type { Contact } from '@/lib/types';
import { getUrgencyTier } from '@/lib/types';

interface ContactRemindersProps {
    contacts: Contact[];
    onFilterOverdue: () => void;
    hidden?: boolean;
}

function ContactReminders({ contacts, onFilterOverdue, hidden = false }: ContactRemindersProps) {
    const [dismissed, setDismissed] = useState(false);

    // Grouped urgency counts — memoized so we don't re-filter 3× on every parent render
    const { criticalContacts, overdueContacts, upcomingContacts, actionableContacts } = useMemo(() => {
        const critical = contacts.filter(c => getUrgencyTier(c) === 'critical');
        const overdue = contacts.filter(c => getUrgencyTier(c) === 'overdue');
        const upcoming = contacts.filter(c => getUrgencyTier(c) === 'upcoming');
        return {
            criticalContacts: critical,
            overdueContacts: overdue,
            upcomingContacts: upcoming,
            actionableContacts: [...critical, ...overdue],
        };
    }, [contacts]);

    const count = actionableContacts.length;

    // Auto-reset dismissed flag when overdue contacts clear
    useEffect(() => {
        if (count === 0) setDismissed(false);
    }, [count]);

    if (count === 0 || dismissed || hidden) return null;

    return (
        <>
            <div
                className="reminder-popup"
                role="button"
                tabIndex={0}
                aria-label="View overdue follow-ups"
                onClick={onFilterOverdue}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFilterOverdue(); } }}
                style={{
                    position: 'fixed',
                    bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 200,
                    padding: '12px 16px',
                    background: criticalContacts.length > 0
                        ? 'var(--color-error-container)'
                        : 'var(--color-warning-container)',
                    borderLeft: criticalContacts.length > 0
                        ? '3px solid var(--color-error)'
                        : '3px solid var(--color-warning)',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: 'var(--elevation-2)',
                    cursor: 'pointer',
                    maxWidth: 'calc(100vw - 48px)',
                }}
            >
                {/* Calendar Icon */}
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 7,
                        background: criticalContacts.length > 0 ? 'var(--color-error)' : 'var(--color-warning)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: 'var(--elevation-1)',
                    }}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                        <line x1="10" y1="16" x2="14" y2="16" />
                    </svg>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                            style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: criticalContacts.length > 0 ? 'var(--color-error)' : 'var(--color-warning)',
                                letterSpacing: '-0.01em',
                            }}
                        >
                            Follow-up Reminders
                        </span>
                        {/* Critical badge */}
                        {criticalContacts.length > 0 && (
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: 22,
                                    height: 22,
                                    padding: '0 6px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: 'var(--color-on-primary)',
                                    background: 'var(--color-error)',
                                    borderRadius: 11,
                                    animation: 'gentlePulse 2.5s ease-in-out infinite',
                                    boxShadow: '0 0 0 0 var(--color-error)',
                                }}
                            >
                                {criticalContacts.length}
                            </span>
                        )}
                        {/* Overdue badge */}
                        {overdueContacts.length > 0 && (
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: 22,
                                    height: 22,
                                    padding: '0 6px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: 'var(--color-on-primary)',
                                    background: 'var(--color-warning)',
                                    borderRadius: 11,
                                    animation: 'gentlePulse 2.5s ease-in-out infinite',
                                    boxShadow: '0 0 0 0 var(--color-warning)',
                                }}
                            >
                                {overdueContacts.length}
                            </span>
                        )}
                        {/* Upcoming badge (secondary) */}
                        {upcomingContacts.length > 0 && (
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: 22,
                                    height: 22,
                                    padding: '0 6px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: 'var(--color-on-primary)',
                                    background: 'var(--color-primary)',
                                    borderRadius: 11,
                                    opacity: 0.85,
                                }}
                            >
                                {upcomingContacts.length}
                            </span>
                        )}
                    </div>
                    <p
                        style={{
                            margin: '3px 0 0 0',
                            fontSize: 12,
                            color: criticalContacts.length > 0
                                ? 'var(--color-error)'
                                : 'var(--color-warning)',
                            lineHeight: 1.4,
                        }}
                    >
                        {criticalContacts.length > 0 && overdueContacts.length > 0
                            ? `${criticalContacts.length} critical · ${overdueContacts.length} overdue`
                            : criticalContacts.length > 0
                                ? `${criticalContacts.length} ${criticalContacts.length === 1 ? 'contact' : 'contacts'} awaiting response`
                                : `${overdueContacts.length} ${overdueContacts.length === 1 ? 'contact needs' : 'contacts need'} follow-up today`}
                        {upcomingContacts.length > 0 && ` · ${upcomingContacts.length} upcoming`}
                    </p>
                </div>

                {/* Dismiss Button */}
                <button
                    className="reminder-dismiss-btn"
                    onClick={e => {
                        e.stopPropagation();
                        setDismissed(true);
                    }}
                    style={{
                        '--color-dismiss': criticalContacts.length > 0 ? 'var(--color-error)' : 'var(--color-warning)',
                        width: 44,
                        height: 44,
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: criticalContacts.length > 0
                            ? 'var(--color-error-muted)'
                            : 'var(--color-warning-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    } as React.CSSProperties}
                    aria-label="Dismiss reminder"
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
        </>
    );
}

export default memo(ContactReminders);
