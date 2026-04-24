'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { Contact } from '@/lib/types';
import {
    CONTACT_STATE_COLORS,
    CONTACT_STATE_LABELS,
    getContactBorderColor,
} from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import CompanyAvatar from '../common/CompanyAvatar';
import DetailHeader from '../common/DetailHeader';
import ExpandableNotes from '../common/ExpandableNotes';
import OutcomeTracker from '../common/OutcomeTracker';
import type { Job } from '@/lib/types';
import { updateContactResponse, addContactInteraction, updateContactNotes, requestContactReenrichment } from '@/lib/db';
import EnrichContactModal from './EnrichContactModal';
import CoachingNudge from './CoachingNudge';
import DraftMessagePanel from './DraftMessagePanel';
import ContactTimeline from './ContactTimeline';

interface Props {
    contact: Contact;
    jobs: Job[];
    onClose: () => void;
    onStateChange: (id: number, state: string) => void;
    onContactUpdated: (updatedContact: Contact) => void;
}

export default function ContactDetail({ contact, jobs, onClose, onStateChange: _onStateChange, onContactUpdated }: Props) {
    const [localNotes, setLocalNotes] = useState(contact.notes ?? '');
    const [showEnrichModal, setShowEnrichModal] = useState(false);
    const borderColor = getContactBorderColor(contact.state);
    const stateColors = CONTACT_STATE_COLORS[contact.state];
    const stateLabel = CONTACT_STATE_LABELS[contact.state];

    // Sanitize URLs to prevent XSS via javascript: protocol
    const safeLinkedInUrl = contact.linkedin_url?.startsWith('http') ? contact.linkedin_url : undefined;
    const safeEmail = contact.email && !contact.email.includes('"') && !contact.email.includes('<') ? contact.email : undefined;

    // Find linked job if exists
    const linkedJob = contact.job_id ? jobs.find(j => j.id === contact.job_id) : null;

    // Outreach coaching logic: time-based nudge (only for actionable states)
    const daysSinceCreated = Math.floor((Date.now() - new Date(contact.created_at).getTime()) / (1000 * 60 * 60 * 24));
    let coachingNudge: string | null = null;
    if (contact.state === 'contacted' && daysSinceCreated >= 3) {
        coachingNudge = "3+ days since outreach — consider a follow-up if you haven't heard back.";
    } else if (contact.state === 'replied' && daysSinceCreated >= 1) {
        coachingNudge = "They've engaged! Respond promptly to keep the momentum.";
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <DetailHeader
                title={`${contact.name} — ${contact.role}`}
                onBack={onClose}
            />

            {/* ── Two-column body ── */}
            <div className="detail-layout" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                {/* Left — enrichment sections */}
                <div style={{
                    flex: 1, overflowY: 'auto', padding: 24,
                    borderRight: '1px solid var(--color-border)', minHeight: 0, minWidth: 0,
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
                                className="cd-enrich-btn"
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: 4,
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-surface)',
                                    fontSize: 11,
                                    color: 'var(--color-text-secondary)',
                                    cursor: 'pointer',
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

                        {/* 3b. Enrichment (from enrich-contacts pipeline) */}
                        {contact.enrichment_status === 'completed' && contact.enrichment && (
                            <div style={{
                                padding: '12px 14px', borderRadius: 10,
                                background: 'var(--color-surface-raised)',
                                border: '1px solid var(--color-border)',
                                fontSize: 12, color: 'var(--color-text-secondary)',
                                lineHeight: 1.5,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Enrichment
                                        {contact.enriched_at && (
                                            <span style={{ fontWeight: 400, marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                                                · {timeAgo(contact.enriched_at)}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await requestContactReenrichment(contact.id);
                                                onContactUpdated({ ...contact, enrichment_status: 'pending' });
                                                toast.success('Queued for re-enrichment');
                                            } catch (err) {
                                                toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
                                            }
                                        }}
                                        title="Mark this contact for re-enrichment on the next pipeline run"
                                        style={{
                                            fontSize: 11,
                                            padding: '3px 10px',
                                            background: 'transparent',
                                            color: 'var(--color-primary)',
                                            border: '1px solid var(--color-primary)',
                                            borderRadius: 999,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Refresh
                                    </button>
                                </div>
                                {typeof contact.enrichment.summary === 'string' && contact.enrichment.summary.length > 0 && (
                                    <div style={{ marginBottom: 8 }}>{contact.enrichment.summary}</div>
                                )}
                                {Array.isArray(contact.enrichment.topics) && contact.enrichment.topics.length > 0 && (
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                                        {contact.enrichment.topics.map((t, idx) => (
                                            <span key={`topic-${idx}`} style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--color-primary-container)', color: 'var(--color-primary)', fontSize: 11 }}>
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {Array.isArray(contact.enrichment.tech_stack) && contact.enrichment.tech_stack.length > 0 && (
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {contact.enrichment.tech_stack.map((t, idx) => (
                                            <span key={`tech-${idx}`} style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--color-surface-container)', color: 'var(--color-text-secondary)', fontSize: 11, border: '1px solid var(--color-border)' }}>
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 4. Outreach Coaching Chip */}
                        {coachingNudge && <CoachingNudge nudge={coachingNudge} />}
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        {/* placeholder for actions if needed */}
                    </div>

                    {/* Drafted message panel */}
                    <DraftMessagePanel
                        contact={contact}
                        jobs={jobs}
                        onContactUpdated={onContactUpdated}
                    />
                </div>

                {/* Right — exact parity with FocusMode: Status → Timeline → Notes */}
                <div className="detail-sidebar" style={{ width: 'clamp(240px, 30vw, 360px)', overflowY: 'auto', padding: 24, minHeight: 0, flexShrink: 0, boxSizing: 'border-box' }}>

                    {/* Timeline */}
                    <ContactTimeline contact={contact} />

                    {/* Notes */}
                    <ExpandableNotes
                        value={localNotes}
                        onChange={setLocalNotes}
                        onSave={async (val) => {
                            try {
                                await updateContactNotes(contact.id, val);
                                onContactUpdated({ ...contact, notes: val });
                            } catch (err) {
                                toast.error('Failed to save notes: ' + (err as Error).message);
                            }
                        }}
                        placeholder="Add notes about this contact..."
                    />

                    {/* Outcome Tracking -- Response status */}
                    {['contacted', 'replied', 'interviewing', 'rejected'].includes(contact.state) && (
                        <>
                            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 24, marginBottom: 12 }}>
                                Response
                            </h3>
                            {contact.state === 'contacted' && contact.got_response === null ? (
                                <OutcomeTracker
                                    outcome={null}
                                    notes={null}
                                    positiveLabel="Got Reply"
                                    negativeLabel="No Response"
                                    positiveDisplay="Received reply"
                                    negativeDisplay="No response"
                                    onPositive={async () => {
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
                                    }}
                                    onNegative={async () => {
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
                                    }}
                                />
                            ) : (
                                <OutcomeTracker
                                    outcome={contact.got_response ?? null}
                                    notes={null}
                                    positiveLabel="Got Reply"
                                    negativeLabel="No Response"
                                    positiveDisplay="Received reply"
                                    negativeDisplay="No response"
                                    onPositive={async () => {}}
                                    onNegative={async () => {}}
                                />
                            )}

                            {/* Interaction Log */}
                            {contact.interaction_log && contact.interaction_log.length > 0 && (
                                <div style={{ marginTop: 12 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                                        Interaction History
                                    </div>
                                    {contact.interaction_log.map((entry) => (
                                        <div key={entry.timestamp} style={{
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
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                                        {linkedJob.title} at {linkedJob.company}
                                    </span>
                                    {linkedJob.got_callback === null && (
                                        <span style={{ fontSize: 11, color: 'var(--color-text-disabled)', whiteSpace: 'nowrap' }}>Pending</span>
                                    )}
                                    {linkedJob.got_callback === true && (
                                        <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 500, whiteSpace: 'nowrap' }}>✓ Callback</span>
                                    )}
                                    {linkedJob.got_callback === false && (
                                        <span style={{ fontSize: 11, color: 'var(--color-error)', whiteSpace: 'nowrap' }}>✗ Rejected</span>
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
