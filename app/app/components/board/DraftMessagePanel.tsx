'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { Contact } from '@/lib/types';
import type { Job } from '@/lib/types';
import { scoreDraft, type DraftScore } from '@/lib/draft-scoring';
import { generateDraftMessage } from '@/lib/llm';
import { extractResumeContext } from '@/lib/resume-context';
import { sendEmail } from '@/lib/email';
import { getSecureConfig } from '@/lib/secure-config';
import { markEmailSent, scheduleEmail, cancelScheduledEmail } from '@/lib/db';

interface Props {
    contact: Contact;
    jobs: Job[];
    onContactUpdated: (c: Contact) => void;
}

export default function DraftMessagePanel({ contact, jobs, onContactUpdated }: Props) {
    const [copied, setCopied] = useState(false);
    const [draftScore, setDraftScore] = useState<DraftScore | null>(null);
    const [scoring, setScoring] = useState(false);
    const [sending, setSending] = useState(false);
    const [localSubject, setLocalSubject] = useState(contact.drafted_subject ?? '');
    const [schedulingEmail, setSchedulingEmail] = useState(false);
    const [scoreHover, setScoreHover] = useState(false);
    const scoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLocalSubject(contact.drafted_subject ?? '');
    }, [contact.id]);

    // Clear score when switching contacts
    useEffect(() => {
        setDraftScore(null);
    }, [contact.id]);

    const handleScore = async () => {
        if (!contact.drafted_message || scoring) return;
        setScoring(true);
        try {
            const result = await scoreDraft({
                draft: contact.drafted_message,
                contactName: contact.name,
                companyName: contact.company_name,
                contactRole: contact.role || undefined,
            });
            setDraftScore(result);
        } catch (err) {
            logger.error('Draft scoring failed', 'DraftMessagePanel', err);
            toast.error('Scoring failed');
        } finally {
            setScoring(false);
        }
    };

    const handleCopy = () => {
        if (contact.drafted_message) {
            navigator.clipboard.writeText(contact.drafted_message);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!contact.drafted_message || contact.state !== 'drafted') return null;

    const linkedJob = contact.job_id ? jobs.find(j => j.id === contact.job_id) : null;

    const scoreColor = draftScore
        ? draftScore.overall >= 70 ? 'var(--color-success)' : draftScore.overall >= 50 ? 'var(--color-warning)' : 'var(--color-error)'
        : 'var(--color-text-tertiary)';

    return (
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

                {/* Subject line input */}
                <div style={{
                    padding: '8px 14px',
                    borderBottom: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                }}>
                    <input
                        aria-label="Email subject"
                        value={localSubject}
                        onChange={e => setLocalSubject(e.target.value)}
                        onBlur={() => {
                            if (localSubject !== (contact.drafted_subject ?? '')) {
                                onContactUpdated({ ...contact, drafted_subject: localSubject });
                            }
                        }}
                        placeholder={`Subject — e.g. "Quick question about ${contact.role ?? 'your role'} at ${contact.company_name}"`}
                        style={{
                            width: '100%',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontSize: 12,
                            color: 'var(--color-text-primary)',
                            fontStyle: localSubject ? 'normal' : 'italic',
                        }}
                    />
                </div>

                {/* Message body — editable */}
                <textarea
                    aria-label="Draft message body"
                    value={contact.drafted_message}
                    onChange={e => onContactUpdated({ ...contact, drafted_message: e.target.value })}
                    style={{
                        display: 'block',
                        width: '100%',
                        padding: '16px 20px',
                        fontSize: 'var(--font-size-md)', lineHeight: 1.8,
                        color: 'var(--color-text-primary)',
                        background: 'var(--color-surface)',
                        border: 'none',
                        outline: 'none',
                        resize: 'vertical',
                        minHeight: 160,
                        maxHeight: 280,
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                    }}
                />

                {/* No inline score section — score shown as badge in footer with hover tooltip */}

                {/* Footer: actions — always visible */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px',
                    borderTop: '1px solid var(--color-border)',
                    background: 'var(--color-surface-container)',
                    flexWrap: 'wrap',
                }}>
                    {/* Score button + hover tooltip */}
                    <div
                        ref={scoreRef}
                        style={{ position: 'relative' }}
                        onMouseEnter={() => draftScore && setScoreHover(true)}
                        onMouseLeave={() => setScoreHover(false)}
                        onFocus={() => draftScore && setScoreHover(true)}
                        onBlur={() => setScoreHover(false)}
                    >
                        <button
                            onClick={handleScore}
                            disabled={scoring}
                            style={{
                                padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                                border: `1px solid ${draftScore ? scoreColor : 'var(--color-outline-variant)'}`,
                                background: draftScore ? 'var(--color-surface-raised)' : 'transparent',
                                color: scoring ? 'var(--color-text-disabled)' : draftScore ? scoreColor : 'var(--color-on-surface-variant)',
                                cursor: scoring ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: 5,
                                transition: 'all 0.15s',
                            }}
                        >
                            {scoring ? 'Scoring...' : draftScore ? (
                                <>
                                    <span style={{ fontWeight: 700 }}>{draftScore.overall}</span>
                                    {draftScore.passesThreshold ? 'Ready' : 'Needs work'}
                                </>
                            ) : 'Check quality'}
                        </button>

                        {/* Hover tooltip with score breakdown */}
                        {scoreHover && draftScore && (
                            <div style={{
                                position: 'absolute', bottom: '100%', left: 0,
                                marginBottom: 6, width: 'min(240px, calc(100vw - 48px))', padding: '10px 12px',
                                background: 'var(--color-surface-raised)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 8, boxShadow: 'var(--elevation-2)',
                                zIndex: 10,
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    <ScoreBar label="Specificity" score={draftScore.specificity} />
                                    <ScoreBar label="Length" score={draftScore.length} />
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                                        <span style={{ color: 'var(--color-text-secondary)' }}>Clear Ask</span>
                                        <span style={{
                                            color: draftScore.hasAsk ? 'var(--color-success)' : 'var(--color-text-disabled)',
                                            fontWeight: 500,
                                        }}>
                                            {draftScore.hasAsk ? 'Yes' : 'No'}
                                        </span>
                                    </div>
                                </div>
                                {draftScore.feedback.length > 0 && (
                                    <div style={{
                                        marginTop: 6, padding: '6px 8px',
                                        background: 'var(--color-warning-container)',
                                        borderRadius: 4, fontSize: 10, lineHeight: 1.5,
                                    }}>
                                        <ul style={{ margin: 0, paddingLeft: 14, color: 'var(--color-warning)' }}>
                                            {draftScore.feedback.map((item) => (
                                                <li key={item} style={{ marginBottom: 1 }}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Regenerate */}
                    <button
                        onClick={async () => {
                            if (!confirm('Regenerate draft? This will replace the current message.')) return;
                            try {
                                const resumeContext = await extractResumeContext(linkedJob ?? undefined);
                                const newDraft = await generateDraftMessage({
                                    contact,
                                    jobTitle: linkedJob?.title,
                                    companyName: contact.company_name,
                                    resumeContext
                                });
                                onContactUpdated({ ...contact, drafted_message: newDraft });
                                setDraftScore(null);
                            } catch (err) {
                                toast.error('Failed to regenerate: ' + (err as Error).message);
                            }
                        }}
                        style={{
                            padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                            border: '1px solid var(--color-warning)',
                            background: 'transparent',
                            color: 'var(--color-warning)',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4,
                            transition: 'all 0.15s',
                        }}
                    >
                        <span style={{ fontSize: 13 }}>↻</span> Regenerate
                    </button>

                    {/* Spacer */}
                    <div style={{ flex: 1 }} />

                    {/* Schedule */}
                    {contact.email && !contact.sent_at && (
                        <>
                            {contact.send_at ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 11, color: 'var(--color-primary)' }}>
                                        Scheduled: {new Date(contact.send_at).toLocaleString()}
                                    </span>
                                    <button
                                        onClick={async () => {
                                            await cancelScheduledEmail(contact.id);
                                            onContactUpdated({ ...contact, send_at: null });
                                            toast.success('Scheduled send cancelled');
                                        }}
                                        style={{
                                            fontSize: 10, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
                                            border: '1px solid var(--color-outline-variant)', background: 'transparent',
                                            color: 'var(--color-on-surface-variant)',
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setSchedulingEmail(s => !s)}
                                        style={{
                                            padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                                            border: '1px solid var(--color-outline-variant)',
                                            background: 'transparent',
                                            color: 'var(--color-on-surface-variant)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Schedule
                                    </button>
                                    {schedulingEmail && (
                                        <input
                                            type="datetime-local"
                                            style={{
                                                fontSize: 11, padding: '4px 6px', borderRadius: 4,
                                                border: '1px solid var(--color-outline)', background: 'var(--color-surface)',
                                            }}
                                            onChange={async (e) => {
                                                if (!e.target.value) return;
                                                const sendAt = new Date(e.target.value);
                                                await scheduleEmail(contact.id, sendAt);
                                                onContactUpdated({ ...contact, send_at: sendAt.toISOString() });
                                                setSchedulingEmail(false);
                                                toast.success(`Scheduled for ${sendAt.toLocaleString()}`);
                                            }}
                                        />
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* Send Email — primary action */}
                    {contact.email ? (
                        <button
                            onClick={async () => {
                                setSending(true);
                                try {
                                    const config = await getSecureConfig();
                                    if (!config.smtp_host) {
                                        toast.error('SMTP not configured — set up in Settings → CRM & Outreach');
                                        return;
                                    }
                                    const subject = localSubject || `Connecting re: ${contact.company_name}`;
                                    const result = await sendEmail(contact.email!, subject, contact.drafted_message!, config);
                                    if (result.accepted) {
                                        await markEmailSent(contact.id);
                                        toast.success(`Email sent to ${contact.email}`);
                                        onContactUpdated({ ...contact, state: 'contacted', sent_at: new Date().toISOString(), drafted_subject: localSubject || null });
                                    } else {
                                        toast.error(`Send failed: ${result.response}`);
                                    }
                                } catch (err) {
                                    toast.error(`Send failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                                } finally {
                                    setSending(false);
                                }
                            }}
                            disabled={sending}
                            style={{
                                padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                border: 'none',
                                background: sending ? 'var(--color-surface-container)' : 'var(--color-success)',
                                color: sending ? 'var(--color-on-surface-variant)' : 'var(--color-on-success)',
                                cursor: sending ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s',
                            }}
                        >
                            {sending ? 'Sending...' : 'Send'}
                        </button>
                    ) : (
                        <span style={{ fontSize: 11, color: 'var(--color-text-disabled)' }}>
                            No email address
                        </span>
                    )}
                </div>

                {/* Bounce / sent status — below footer if applicable */}
                {(contact.sent_at || contact.bounce_type) && (
                    <div style={{ padding: '6px 14px 8px', background: 'var(--color-surface-container)' }}>
                        {contact.sent_at && (
                            <div style={{ fontSize: 11, color: 'var(--color-success)' }}>
                                Sent {new Date(contact.sent_at).toLocaleDateString()}
                            </div>
                        )}
                        {contact.bounce_type && (
                            <div style={{ fontSize: 11, color: 'var(--color-error)' }}>
                                {contact.bounce_type === 'hard' ? 'Hard bounce' : 'Soft bounce'} — delivery failed
                                {contact.bounce_reason && (
                                    <div style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', marginTop: 2, fontFamily: 'monospace' }}>
                                        {contact.bounce_reason}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const ScoreBar = React.memo(function ScoreBar({ label, score }: { label: string; score: number }) {
    const color = score >= 70 ? 'var(--color-success)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-error)';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', minWidth: 70 }}>
                {label}
            </span>
            <div style={{
                flex: 1, height: 5,
                background: 'var(--color-surface-container)',
                borderRadius: 3, overflow: 'hidden',
            }}>
                <div style={{
                    height: '100%', width: `${score}%`,
                    background: color,
                    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 500, color, width: 24, textAlign: 'right' }}>
                {score}
            </span>
        </div>
    );
});
