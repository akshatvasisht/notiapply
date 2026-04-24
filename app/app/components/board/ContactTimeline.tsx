'use client';

import { useState } from 'react';
import type { Contact } from '@/lib/types';
import { timeAgo } from '@/lib/utils';

interface Props {
    contact: Contact;
}

function TimelineEvent({ label, date, highlight, action }: { label: string; date: string; highlight?: boolean; action?: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: highlight ? 'var(--color-success)' : 'var(--color-text-disabled)',
            }} />
            <span style={{ fontSize: 12, color: highlight ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                {label}
            </span>
            {action}
            <span style={{ fontSize: 11, color: 'var(--color-text-disabled)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                {timeAgo(date)}
            </span>
        </div>
    );
}

export default function ContactTimeline({ contact }: Props) {
    const [msgExpanded, setMsgExpanded] = useState(false);

    return (
        <>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 24, marginBottom: 12 }}>
                Timeline
            </h3>
            <TimelineEvent label="Added to CRM" date={contact.created_at} />
            {contact.drafted_message && (
                <TimelineEvent
                    label="Message drafted"
                    date={contact.created_at}
                />
            )}
            {(['contacted', 'replied', 'interviewing', 'rejected'] as Contact['state'][]).includes(contact.state) && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <TimelineEvent
                        label="Reached out"
                        date={contact.created_at}
                        action={contact.drafted_message ? (
                            <button
                                onClick={() => setMsgExpanded(!msgExpanded)}
                                style={{
                                    background: 'none', border: 'none', padding: 0,
                                    fontSize: 11, cursor: 'pointer', color: 'var(--color-primary)',
                                    textDecoration: 'underline', marginLeft: 8
                                }}
                            >
                                {msgExpanded ? 'Hide message' : 'View message'}
                            </button>
                        ) : undefined}
                    />
                    {msgExpanded && contact.drafted_message && (
                        <div style={{
                            margin: '4px 0 12px 14px',
                            padding: '10px 14px',
                            fontSize: 12, lineHeight: 1.6,
                            color: 'var(--color-text-secondary)',
                            background: 'var(--color-surface-raised)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 6,
                            whiteSpace: 'pre-wrap'
                        }}>
                            {contact.drafted_message}
                        </div>
                    )}
                </div>
            )}
            {(['replied', 'interviewing'] as Contact['state'][]).includes(contact.state) && (
                <TimelineEvent label="Got a response" date={contact.created_at} highlight />
            )}
            {contact.state === 'interviewing' && (
                <TimelineEvent label="Interviewing" date={contact.created_at} highlight />
            )}
            {contact.state === 'rejected' && (
                <TimelineEvent label="Closed" date={contact.created_at} />
            )}
        </>
    );
}
