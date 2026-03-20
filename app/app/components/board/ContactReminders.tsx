'use client';

import { useEffect, useState } from 'react';
import type { Contact } from '@/lib/types';

interface ContactRemindersProps {
    contacts: Contact[];
    onFilterOverdue: () => void;
}

export default function ContactReminders({ contacts, onFilterOverdue }: ContactRemindersProps) {
    const [dismissed, setDismissed] = useState(false);
    const [visible, setVisible] = useState(false);

    // Count contacts with overdue follow-ups
    const overdueContacts = contacts.filter(c => {
        if (!c.follow_up_date) return false;
        const followUpDate = new Date(c.follow_up_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return followUpDate <= today && ['contacted', 'replied'].includes(c.state);
    });

    const count = overdueContacts.length;

    useEffect(() => {
        if (count > 0 && !dismissed) {
            // Delay to trigger slide-in animation
            const timer = setTimeout(() => setVisible(true), 50);
            return () => clearTimeout(timer);
        } else {
            setVisible(false);
        }
    }, [count, dismissed]);

    // Auto-dismiss when no overdue contacts
    useEffect(() => {
        if (count === 0) {
            setDismissed(false);
        }
    }, [count]);

    if (count === 0 || dismissed) return null;

    return (
        <div
            style={{
                overflow: 'hidden',
                maxHeight: visible ? '60px' : '0',
                opacity: visible ? 1 : 0,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            <div
                style={{
                    margin: '12px 16px',
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, var(--color-warning-container) 0%, color-mix(in srgb, var(--color-warning-container) 90%, white) 100%)',
                    borderLeft: '3px solid var(--color-warning)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
                    cursor: 'pointer',
                    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s',
                    animation: 'slideInFromTop 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onClick={onFilterOverdue}
                onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)';
                }}
            >
                {/* Calendar Icon */}
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 7,
                        background: 'var(--color-warning)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    }}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
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
                                color: 'var(--color-warning)',
                                letterSpacing: '-0.01em',
                            }}
                        >
                            Follow-up Reminders
                        </span>
                        {/* Pulsing Badge */}
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
                                color: 'white',
                                background: 'var(--color-warning)',
                                borderRadius: 11,
                                animation: 'gentlePulse 2.5s ease-in-out infinite',
                                boxShadow: '0 0 0 0 var(--color-warning)',
                            }}
                        >
                            {count}
                        </span>
                    </div>
                    <p
                        style={{
                            margin: '3px 0 0 0',
                            fontSize: 12,
                            color: 'color-mix(in srgb, var(--color-warning) 85%, black)',
                            lineHeight: 1.4,
                        }}
                    >
                        {count === 1 ? '1 contact needs' : `${count} contacts need`} follow-up today
                    </p>
                </div>

                {/* Dismiss Button */}
                <button
                    onClick={e => {
                        e.stopPropagation();
                        setDismissed(true);
                    }}
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: 'color-mix(in srgb, var(--color-warning) 70%, transparent)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'color-mix(in srgb, var(--color-warning) 15%, transparent)';
                        e.currentTarget.style.color = 'var(--color-warning)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'color-mix(in srgb, var(--color-warning) 70%, transparent)';
                    }}
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

                {/* Inline Keyframes */}
                <style>{`
                    @keyframes slideInFromTop {
                        from {
                            transform: translateY(-10px);
                            opacity: 0;
                        }
                        to {
                            transform: translateY(0);
                            opacity: 1;
                        }
                    }

                    @keyframes gentlePulse {
                        0%, 100% {
                            box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.4);
                        }
                        50% {
                            box-shadow: 0 0 0 6px rgba(251, 191, 36, 0);
                        }
                    }
                `}</style>
            </div>
        </div>
    );
}
