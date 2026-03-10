'use client';

import { useState } from 'react';
import type { Contact } from '@/lib/types';
import {
    CONTACT_STATE_COLORS,
    CONTACT_STATE_LABELS,
    getContactBorderColor,
} from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import CompanyAvatar from '../common/CompanyAvatar';
import type { Job } from '@/lib/types';

interface Props {
    contact: Contact;
    jobs: Job[];
    onClose: () => void;
    onStateChange: (id: number, state: string) => void;
}

export default function ContactDetail({ contact, jobs, onClose, onStateChange: _onStateChange }: Props) {
    const [copied, setCopied] = useState(false);
    const [notesExpanded, setNotesExpanded] = useState(false);
    const [msgExpanded, setMsgExpanded] = useState(false);
    const borderColor = getContactBorderColor(contact.state);
    const stateColors = CONTACT_STATE_COLORS[contact.state];
    const stateLabel = CONTACT_STATE_LABELS[contact.state];

    // Find linked job if exists
    const linkedJob = contact.job_id ? jobs.find(j => j.id === contact.job_id) : null;

    // Outreach coaching logic: simple time-based nudge
    const daysSinceCreated = Math.floor((Date.now() - new Date(contact.created_at).getTime()) / (1000 * 60 * 60 * 24));
    let coachingNudge = null;
    if (contact.state === 'contacted' && daysSinceCreated >= 3) {
        coachingNudge = "3+ days since outreach — consider a follow-up if you haven't heard back.";
    } else if (contact.state === 'replied' && daysSinceCreated >= 1) {
        coachingNudge = "They've engaged! Respond promptly to keep the momentum.";
    } else if (contact.state === 'identified') {
        coachingNudge = "Prospect identified. Ready to draft a personalized note?";
    }


    const handleCopy = () => {
        if (contact.drafted_message) {
            navigator.clipboard.writeText(contact.drafted_message);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

            {/* ── Header: exact parity with FocusMode ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                height: 44, padding: '0 16px', flexShrink: 0,
                background: 'var(--color-surface-container)',
                borderBottom: '1px solid var(--color-border)',
            }}>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 16, color: 'var(--color-text-secondary)',
                        padding: '4px 8px', display: 'flex', alignItems: 'center',
                    }}
                >
                    ‹ Back
                </button>
                {/* Centered — matches FocusMode's "Company — Title" */}
                <span style={{ flex: 1, fontSize: 'var(--font-size-md)', fontWeight: 500, color: 'var(--color-text-primary)', textAlign: 'center' }}>
                    {contact.name} — {contact.role}
                </span>
                {/* No badge here — source/state is in the right panel Status section */}
            </div>

            {/* ── Two-column body ── */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                {/* Left — enrichment sections */}
                <div style={{
                    flex: 1, overflowY: 'auto', padding: 24,
                    borderRight: '1px solid var(--color-border)', minHeight: 0,
                }}>
                    {/* Identity block */}
                    <div style={{
                        borderLeft: `4px solid ${borderColor}`,
                        paddingLeft: 16, marginBottom: 20,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <CompanyAvatar name={contact.name} size={48} />
                            <div>
                                <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                                    {contact.name}
                                </h2>
                                <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                                    {contact.role}
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <span>{contact.company_name}</span>
                            {contact.linkedin_url && (
                                <a href={contact.linkedin_url} target="_blank" rel="noreferrer"
                                    style={{ color: '#0077B5', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, fontSize: 'var(--font-size-sm)' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                                        <rect x="2" y="9" width="4" height="12" />
                                        <circle cx="4" cy="4" r="2" />
                                    </svg>
                                    View LinkedIn
                                </a>
                            )}
                            {contact.email && (
                                <a href={`mailto:${contact.email}`}
                                    style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, fontSize: 'var(--font-size-sm)' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="2" y="4" width="20" height="16" rx="2" />
                                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                    </svg>
                                    {contact.email}
                                </a>
                            )}
                        </div>
                    </div>

                    {/* v1 Enrichment Rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                        {/* 1. Applied via Job */}
                        {linkedJob && (
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: '6px 12px', borderRadius: 20,
                                background: 'var(--color-primary-container)',
                                color: 'var(--color-primary)', fontSize: 12, fontWeight: 500,
                            }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                                </svg>
                                Applied via: {linkedJob.title} @ {linkedJob.company}
                            </div>
                        )}

                        {/* 2. Company Intel Chips */}
                        {(contact.company_industry || contact.company_funding_stage || contact.company_headcount_range) && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {contact.company_industry && (
                                    <div style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                                        {contact.company_industry}
                                    </div>
                                )}
                                {contact.company_funding_stage && (
                                    <div style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                                        {contact.company_funding_stage}
                                    </div>
                                )}
                                {contact.company_headcount_range && (
                                    <div style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                                        {contact.company_headcount_range}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. Recent Activity Block */}
                        {contact.linkedin_posts_summary && (
                            <div style={{
                                padding: '12px 14px', borderRadius: 10,
                                background: 'var(--color-surface-raised)',
                                border: '1px solid var(--color-border)',
                                fontSize: 12, color: 'var(--color-text-secondary)',
                                lineHeight: 1.5, position: 'relative',
                            }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Recent LinkedIn Activity
                                </div>
                                <em>"{contact.linkedin_posts_summary}"</em>
                            </div>
                        )}

                        {/* 4. Outreach Coaching Chip */}
                        {coachingNudge && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '10px 14px', borderRadius: 8,
                                background: 'rgba(255, 171, 0, 0.08)',
                                border: '1px solid rgba(255, 171, 0, 0.3)',
                                color: 'var(--color-warning)', fontSize: 'var(--font-size-sm)',
                            }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                {coachingNudge}
                            </div>
                        )}
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        {/* placeholder for actions if needed */}
                    </div>


                    {/* Drafted message — only show prominently if in 'drafted' state */}
                    {contact.drafted_message && contact.state === 'drafted' && (
                        <div style={{ marginBottom: 24 }}>
                            <div style={{
                                border: '1px solid var(--color-border)',
                                borderRadius: 10,
                                overflow: 'hidden',
                                boxShadow: 'var(--elevation-1)',
                            }}>
                                {/* Letterhead strip */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '10px 14px',
                                    background: 'var(--color-surface-container)',
                                    borderBottom: '1px solid var(--color-border)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2">
                                            <rect x="2" y="4" width="20" height="16" rx="2" />
                                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                        </svg>
                                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                                            Draft → {contact.name}
                                        </span>
                                        {contact.email && (
                                            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                                                &lt;{contact.email}&gt;
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleCopy}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            padding: '4px 10px', borderRadius: 6,
                                            background: copied ? 'var(--color-success-container)' : 'transparent',
                                            border: `1px solid ${copied ? 'var(--color-success)' : 'var(--color-outline-variant)'}`,
                                            cursor: 'pointer',
                                            color: copied ? 'var(--color-success)' : 'var(--color-on-surface-variant)',
                                            fontSize: 12, lineHeight: 1, transition: 'all 0.2s',
                                        }}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                {/* Message body */}
                                <div style={{
                                    padding: '16px 20px',
                                    fontSize: 'var(--font-size-md)', lineHeight: 1.8,
                                    whiteSpace: 'pre-wrap',
                                    color: 'var(--color-text-primary)',
                                    background: 'var(--color-surface)',
                                }}>
                                    {contact.drafted_message}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right — exact parity with FocusMode: Status → Timeline → Notes */}
                <div style={{ width: 360, overflowY: 'auto', padding: 24, minHeight: 0, flexShrink: 0 }}>

                    {/* Status — matches FocusMode exactly */}
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 0, marginBottom: 16 }}>
                        Status
                    </h3>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
                        padding: '8px 12px', borderRadius: 6,
                        background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
                    }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: stateColors.text }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                            {stateLabel}
                        </span>
                    </div>

                    {/* Timeline */}
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

                    {/* Notes — matches FocusMode exactly */}
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 24, marginBottom: 12 }}>
                        Notes
                    </h3>
                    <button
                        onClick={() => setNotesExpanded(e => !e)}
                        style={{
                            width: '100%', padding: '8px 12px', borderRadius: 6,
                            border: '1px solid var(--color-outline-variant)',
                            background: 'var(--color-surface-raised)',
                            color: 'var(--color-on-surface)', fontSize: 12,
                            cursor: 'pointer', textAlign: 'left',
                            marginBottom: notesExpanded ? 8 : 0,
                        }}
                    >
                        {notesExpanded ? '▼ Hide notes' : '▶ Add notes'}
                    </button>
                    {notesExpanded && (
                        <div style={{
                            padding: '10px 14px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-outline-variant)',
                            borderRadius: 6, fontSize: 12, lineHeight: 1.6,
                            color: 'var(--color-on-surface)',
                        }}>
                            {contact.notes || <span style={{ color: 'var(--color-text-disabled)' }}>No notes yet...</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
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
