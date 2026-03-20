'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { Contact } from '@/lib/types';
import {
    CONTACT_STATE_COLORS,
    CONTACT_STATE_LABELS,
    getContactBorderColor,
} from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import CompanyAvatar from '../common/CompanyAvatar';
import type { Job } from '@/lib/types';
import { scoreDraft, type DraftScore } from '@/lib/draft-scoring';
import { updateContactResponse, addContactInteraction } from '@/lib/db';
import { generateDraftMessage } from '@/lib/llm';
import { extractResumeContext } from '@/lib/resume-context';
import EnrichContactModal from './EnrichContactModal';

interface Props {
    contact: Contact;
    jobs: Job[];
    onClose: () => void;
    onStateChange: (id: number, state: string) => void;
    onContactUpdated: (updatedContact: Contact) => void;
}

export default function ContactDetail({ contact, jobs, onClose, onStateChange: _onStateChange, onContactUpdated }: Props) {
    const [copied, setCopied] = useState(false);
    const [notesExpanded, setNotesExpanded] = useState(false);
    const [msgExpanded, setMsgExpanded] = useState(false);
    const [draftScore, setDraftScore] = useState<DraftScore | null>(null);
    const [scoring, setScoring] = useState(false);
    const [showEnrichModal, setShowEnrichModal] = useState(false);
    const borderColor = getContactBorderColor(contact.state);
    const stateColors = CONTACT_STATE_COLORS[contact.state];
    const stateLabel = CONTACT_STATE_LABELS[contact.state];

    // Sanitize URLs to prevent XSS via javascript: protocol
    const safeLinkedInUrl = contact.linkedin_url?.startsWith('http') ? contact.linkedin_url : undefined;
    const safeEmail = contact.email && !contact.email.includes('"') && !contact.email.includes('<') ? contact.email : undefined;

    // Score draft when message exists and is in 'drafted' state
    useEffect(() => {
        if (contact.drafted_message && contact.state === 'drafted' && !draftScore && !scoring) {
            setScoring(true);
            scoreDraft({
                draft: contact.drafted_message,
                contactName: contact.name,
                companyName: contact.company_name,
                contactRole: contact.role || undefined,
            })
                .then(setDraftScore)
                .catch(err => {
                    logger.error('Draft scoring failed', 'ContactDetail', err);
                })
                .finally(() => setScoring(false));
        }
    }, [contact.drafted_message, contact.state, contact.name, contact.company_name, contact.role, draftScore, scoring]);

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
                            <button
                                onClick={() => setShowEnrichModal(true)}
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: 4,
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-surface)',
                                    fontSize: 11,
                                    color: 'var(--color-text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                                    e.currentTarget.style.color = 'var(--color-primary)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                                }}
                            >
                                + Enrich
                            </button>
                            {safeLinkedInUrl && (
                                <a href={safeLinkedInUrl} target="_blank" rel="noreferrer"
                                    style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, fontSize: 'var(--font-size-sm)' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                                        <rect x="2" y="9" width="4" height="12" />
                                        <circle cx="4" cy="4" r="2" />
                                    </svg>
                                    View LinkedIn
                                </a>
                            )}
                            {safeEmail && (
                                <a href={`mailto:${safeEmail}`}
                                    style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, fontSize: 'var(--font-size-sm)' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="2" y="4" width="20" height="16" rx="2" />
                                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                    </svg>
                                    {safeEmail}
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
                                background: 'var(--color-warning-container)',
                                border: '1px solid var(--color-warning)',
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

                                {/* Draft Quality Score */}
                                {scoring && (
                                    <div style={{
                                        padding: '12px 16px',
                                        background: 'var(--color-surface-raised)',
                                        borderTop: '1px solid var(--color-border)',
                                        fontSize: 12,
                                        color: 'var(--color-text-secondary)',
                                    }}>
                                        Analyzing draft quality...
                                    </div>
                                )}

                                {draftScore && (
                                    <div style={{
                                        padding: '14px 16px',
                                        background: 'var(--color-surface-raised)',
                                        borderTop: '1px solid var(--color-border)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Quality Score
                                                </span>
                                                {draftScore.passesThreshold && (
                                                    <div style={{
                                                        padding: '2px 8px',
                                                        borderRadius: 4,
                                                        background: 'var(--color-success-container)',
                                                        color: 'var(--color-success)',
                                                        fontSize: 10,
                                                        fontWeight: 600,
                                                    }}>
                                                        READY
                                                    </div>
                                                )}
                                            </div>
                                            <span style={{
                                                fontSize: 18,
                                                fontWeight: 700,
                                                color: draftScore.overall >= 70 ? 'var(--color-success)' : draftScore.overall >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                                            }}>
                                                {draftScore.overall}
                                                <span style={{ fontSize: 12, fontWeight: 400 }}>/100</span>
                                            </span>
                                        </div>

                                        {/* Sub-scores */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                                            <ScoreBar label="Specificity" score={draftScore.specificity} />
                                            <ScoreBar label="Length" score={draftScore.length} />
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                                                <span style={{ color: 'var(--color-text-secondary)' }}>Clear Ask</span>
                                                <span style={{
                                                    color: draftScore.hasAsk ? 'var(--color-success)' : 'var(--color-text-disabled)',
                                                    fontWeight: 500,
                                                }}>
                                                    {draftScore.hasAsk ? '✓ Yes' : '✗ No'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Feedback */}
                                        {draftScore.feedback.length > 0 && (
                                            <div style={{
                                                padding: '10px 12px',
                                                background: 'var(--color-warning-container)',
                                                borderRadius: 6,
                                                fontSize: 11,
                                                lineHeight: 1.5,
                                            }}>
                                                <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--color-warning)' }}>
                                                    Suggestions:
                                                </div>
                                                <ul style={{ margin: 0, paddingLeft: 16, color: 'color-mix(in srgb, var(--color-warning) 85%, black)' }}>
                                                    {draftScore.feedback.map((item, i) => (
                                                        <li key={i} style={{ marginBottom: 2 }}>{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Draft Actions */}
                                        <div style={{
                                            display: 'flex',
                                            gap: 8,
                                            padding: '12px 16px',
                                            borderTop: '1px solid var(--color-border)',
                                            background: 'var(--color-surface-raised)',
                                        }}>
                                            {!draftScore.passesThreshold && (
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm('Regenerate draft? This will replace the current message.')) return;

                                                        try {
                                                            const linkedJob = contact.job_id ? jobs.find(j => j.id === contact.job_id) : null;
                                                            const resumeContext = await extractResumeContext(linkedJob);
                                                            const newDraft = await generateDraftMessage({
                                                                contact,
                                                                jobTitle: linkedJob?.title,
                                                                companyName: contact.company_name,
                                                                resumeContext
                                                            });
                                                            onContactUpdated({ ...contact, drafted_message: newDraft });
                                                        } catch (err) {
                                                            toast.error('Failed to regenerate: ' + (err as Error).message);
                                                        }
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px 12px',
                                                        borderRadius: 6,
                                                        border: '1px solid var(--color-warning)',
                                                        background: 'rgba(251, 191, 36, 0.08)',
                                                        color: 'var(--color-warning)',
                                                        fontSize: 12,
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: 6,
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(251, 191, 36, 0.15)';
                                                        e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.6)';
                                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.15)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'rgba(251, 191, 36, 0.08)';
                                                        e.currentTarget.style.borderColor = 'var(--color-warning)';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                        e.currentTarget.style.boxShadow = 'none';
                                                    }}
                                                    onMouseDown={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(0) scale(0.98)';
                                                    }}
                                                    onMouseUp={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(-1px) scale(1)';
                                                    }}
                                                >
                                                    <span style={{ fontSize: 14 }}>↻</span>
                                                    Regenerate Draft
                                                </button>
                                            )}

                                            {draftScore.passesThreshold && (
                                                <button
                                                    onClick={async () => {
                                                        await navigator.clipboard.writeText(contact.drafted_message!);
                                                        toast.success('Draft copied to clipboard!', {
                                                            description: 'Paste into your email client and send.'
                                                        });
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px 12px',
                                                        borderRadius: 6,
                                                        border: 'none',
                                                        background: 'var(--color-success)',
                                                        color: 'white',
                                                        fontSize: 12,
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: 6,
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
                                                        e.currentTarget.style.filter = 'brightness(1.05)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                        e.currentTarget.style.boxShadow = 'none';
                                                        e.currentTarget.style.filter = 'brightness(1)';
                                                    }}
                                                    onMouseDown={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(0) scale(0.98)';
                                                    }}
                                                    onMouseUp={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(-1px) scale(1)';
                                                    }}
                                                >
                                                    <span style={{ fontSize: 14 }}>✓</span>
                                                    Accept & Copy
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
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

                    {/* Outcome Tracking — Response status */}
                    {['contacted', 'replied', 'interviewing', 'rejected'].includes(contact.state) && (
                        <>
                            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 24, marginBottom: 12 }}>
                                Response
                            </h3>
                            {/* Response Tracking - INTERACTIVE */}
                            {contact.state === 'contacted' && contact.got_response === null && (
                                <div style={{
                                    padding: '12px 14px',
                                    background: 'var(--color-surface-raised)',
                                    borderRadius: 8,
                                    border: '1px solid var(--color-border)',
                                }}>
                                    <div style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: 'var(--color-text-secondary)',
                                        marginBottom: 10,
                                        letterSpacing: '0.3px',
                                        textTransform: 'uppercase',
                                    }}>
                                        Track Response
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await updateContactResponse(contact.id, true);
                                                    await addContactInteraction(
                                                        contact.id,
                                                        'Received reply',
                                                        'Manually marked as replied'
                                                    );

                                                    onContactUpdated({
                                                        ...contact,
                                                        got_response: true,
                                                        state: 'replied',
                                                        interaction_log: [
                                                            ...(contact.interaction_log || []),
                                                            {
                                                                timestamp: new Date().toISOString(),
                                                                event: 'Received reply',
                                                                notes: 'Manually marked as replied'
                                                            }
                                                        ]
                                                    });
                                                } catch (err) {
                                                    toast.error((err as Error).message);
                                                }
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '8px 12px',
                                                borderRadius: 6,
                                                border: 'none',
                                                background: 'var(--color-success)',
                                                color: 'white',
                                                fontSize: 12,
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.25)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = 'none';
                                            }}
                                            onMouseDown={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0) scale(0.98)';
                                            }}
                                            onMouseUp={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-1px) scale(1)';
                                            }}
                                        >
                                            ✓ Got Reply
                                        </button>

                                        <button
                                            onClick={async () => {
                                                try {
                                                    await updateContactResponse(contact.id, false);
                                                    await addContactInteraction(
                                                        contact.id,
                                                        'No response received',
                                                        'Manually marked as ghosted'
                                                    );

                                                    onContactUpdated({
                                                        ...contact,
                                                        got_response: false,
                                                        interaction_log: [
                                                            ...(contact.interaction_log || []),
                                                            {
                                                                timestamp: new Date().toISOString(),
                                                                event: 'No response received',
                                                                notes: 'Manually marked as ghosted'
                                                            }
                                                        ]
                                                    });
                                                } catch (err) {
                                                    toast.error((err as Error).message);
                                                }
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '8px 12px',
                                                borderRadius: 6,
                                                border: '1px solid var(--color-border)',
                                                background: 'var(--color-surface)',
                                                color: 'var(--color-text-secondary)',
                                                fontSize: 12,
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--color-text-tertiary)';
                                                e.currentTarget.style.background = 'var(--color-surface-container)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--color-border)';
                                                e.currentTarget.style.background = 'var(--color-surface)';
                                            }}
                                            onMouseDown={(e) => {
                                                e.currentTarget.style.transform = 'scale(0.98)';
                                            }}
                                            onMouseUp={(e) => {
                                                e.currentTarget.style.transform = 'scale(1)';
                                            }}
                                        >
                                            No Response
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Response Status - DISPLAY (after marked) */}
                            {contact.got_response !== null && (
                                <div style={{
                                    padding: '10px 14px',
                                    borderRadius: 6,
                                    background: contact.got_response
                                        ? 'var(--color-success-container)'
                                        : 'var(--color-surface-raised)',
                                    border: contact.got_response
                                        ? '1px solid rgba(34, 197, 94, 0.2)'
                                        : '1px solid var(--color-border)',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: contact.got_response
                                        ? 'var(--color-success)'
                                        : 'var(--color-text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}>
                                    <span style={{
                                        fontSize: 14,
                                        lineHeight: 1,
                                    }}>
                                        {contact.got_response ? '✓' : '✗'}
                                    </span>
                                    {contact.got_response ? 'Received reply' : 'No response'}
                                </div>
                            )}

                            {/* Interaction Log */}
                            {contact.interaction_log && contact.interaction_log.length > 0 && (
                                <div style={{ marginTop: 12 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                                        Interaction History
                                    </div>
                                    {contact.interaction_log.map((entry, i) => (
                                        <div key={i} style={{
                                            padding: '8px 10px',
                                            background: 'var(--color-surface)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 4,
                                            marginBottom: 6,
                                            fontSize: 11,
                                        }}>
                                            <div style={{ fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 2 }}>
                                                {entry.event}
                                            </div>
                                            {entry.notes && (
                                                <div style={{ color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                                                    {entry.notes}
                                                </div>
                                            )}
                                            <div style={{ color: 'var(--color-text-disabled)', fontSize: 10 }}>
                                                {timeAgo(entry.timestamp)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Linked Job Callback Tracking */}
                    {linkedJob && (
                        <>
                            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 24, marginBottom: 12 }}>
                                Application Outcome
                            </h3>
                            <div style={{
                                padding: '10px 12px',
                                background: 'var(--color-surface-raised)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 6,
                            }}>
                                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                                    {linkedJob.title} at {linkedJob.company}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    {linkedJob.got_callback === null && (
                                        <span style={{ fontSize: 13, color: 'var(--color-text-disabled)' }}>⏳ No response yet</span>
                                    )}
                                    {linkedJob.got_callback === true && (
                                        <span style={{ fontSize: 13, color: 'var(--color-success)', fontWeight: 500 }}>✓ Got callback</span>
                                    )}
                                    {linkedJob.got_callback === false && (
                                        <span style={{ fontSize: 13, color: 'var(--color-error)' }}>✗ Rejected</span>
                                    )}
                                </div>
                                {linkedJob.callback_notes && (
                                    <div style={{
                                        padding: '8px 10px',
                                        background: 'var(--color-surface)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 4,
                                        fontSize: 11,
                                        color: 'var(--color-text-secondary)',
                                        lineHeight: 1.5,
                                    }}>
                                        <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--color-text-primary)' }}>
                                            What resonated:
                                        </div>
                                        {linkedJob.callback_notes}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Enrichment Modal */}
            {showEnrichModal && (
                <EnrichContactModal
                    contact={contact}
                    onClose={() => setShowEnrichModal(false)}
                    onUpdated={(updatedContact) => {
                        onContactUpdated(updatedContact);
                        setShowEnrichModal(false);
                    }}
                />
            )}
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

function ScoreBar({ label, score }: { label: string; score: number }) {
    const color = score >= 70 ? 'var(--color-success)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-error)';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 70 }}>
                {label}
            </span>
            <div style={{
                flex: 1,
                height: 6,
                background: 'var(--color-surface-container)',
                borderRadius: 3,
                overflow: 'hidden',
            }}>
                <div style={{
                    height: '100%',
                    width: `${score}%`,
                    background: color,
                    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 500, color, width: 30, textAlign: 'right' }}>
                {score}
            </span>
        </div>
    );
}
