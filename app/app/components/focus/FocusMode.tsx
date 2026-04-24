'use client';

import { useEffect, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { Job, Application } from '@/lib/types';
import { getApplicationByJobId, updateJobState, updateJobCallback, getJobById, updateApplicationDraftAnswers, updateApplicationNotes, hasDatabase } from '@/lib/db';
import { SOURCE_LABELS, SOURCE_COLORS, getCardBorderColor } from '@/lib/types';
import { timeAgo, formatSalary } from '@/lib/utils';
import CompanyAvatar from '../common/CompanyAvatar';
import ActionButton from '../common/ActionButton';
import DetailHeader from '../common/DetailHeader';
import ExpandableNotes from '../common/ExpandableNotes';
import OutcomeTracker from '../common/OutcomeTracker';
import SharedTextArea from '../common/SharedTextArea';

interface FocusModeProps {
  job: Job;
  onBack: () => void;
}

/** State-specific action buttons for Focus Mode */
function StateActions({ job, onAction }: { job: Job; onAction: (newState: string) => void }) {
  switch (job.state) {
    case 'discovered':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton label="Archive" color="var(--color-text-tertiary)" onClick={() => onAction('filtered-out')} />
        </div>
      );
    case 'queued':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton label="Archive" color="var(--color-text-tertiary)" onClick={() => onAction('filtered-out')} />
        </div>
      );
    case 'review-ready':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton label="Mark Submitted" color="var(--color-success)" onClick={() => onAction('submitted')} />
          <ActionButton label="Reject" color="var(--color-error)" onClick={() => onAction('rejected')} />
        </div>
      );
    case 'review-incomplete':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton label="Mark Submitted" color="var(--color-success)" onClick={() => onAction('submitted')} />
          <ActionButton label="Reject" color="var(--color-error)" onClick={() => onAction('rejected')} />
          <ActionButton label="Re-queue" color="var(--color-primary)" onClick={() => onAction('queued')} />
        </div>
      );
    case 'fill-failed':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton label="Re-queue" color="var(--color-primary)" onClick={() => onAction('queued')} />
          <ActionButton label="Archive" color="var(--color-text-tertiary)" onClick={() => onAction('filtered-out')} />
        </div>
      );
    case 'submitted':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton label="Track" color="var(--color-success)" onClick={() => onAction('tracking')} />
          <ActionButton label="Rejected" color="var(--color-error)" onClick={() => onAction('rejected')} />
        </div>
      );
    default:
      return null;
  }
}



export default function FocusMode({ job, onBack }: FocusModeProps) {
  const [application, setApplication] = useState<Application | null>(null);
  const [currentJob, setCurrentJob] = useState(job);
  const [notes, setNotes] = useState('');
  const [draftAnswers, setDraftAnswers] = useState<Array<{ question: string; answer: string }>>([]);
  const [draftAnswersSaving, setDraftAnswersSaving] = useState(false);
  const [scoreBreakdownExpanded, setScoreBreakdownExpanded] = useState(false);

  useEffect(() => {
    if (!hasDatabase()) return;
    getApplicationByJobId(job.id).then(app => {
      setApplication(app);
      if (app?.draft_answers) {
        setDraftAnswers(app.draft_answers);
      }
      if (app?.fill_notes !== undefined) {
        setNotes(app?.fill_notes ?? '');
      }
    }).catch((err) => {
      logger.error('Failed to load application', 'FocusMode', err);
    });
  }, [job.id]);

  // Configure marked options
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  const handleAction = async (newState: string) => {
    await updateJobState(currentJob.id, newState);
    setCurrentJob({ ...currentJob, state: newState as Job['state'] });
  };

  const refreshJobData = async () => {
    try {
      const updated = await getJobById(currentJob.id);
      if (updated) {
        setCurrentJob(updated);
      }
    } catch (err) {
      logger.error('Failed to refresh job data', 'FocusMode', err);
      toast.error('Failed to refresh job data');
    }
  };

  const salary = formatSalary(currentJob.salary_min, currentJob.salary_max);
  const sourceColors = SOURCE_COLORS[currentJob.source] ?? { text: 'var(--color-text-tertiary)', bg: 'var(--color-surface-raised)' };
  const sourceLabel = SOURCE_LABELS[currentJob.source] ?? currentJob.source;
  const borderColor = getCardBorderColor(currentJob.state);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <DetailHeader
        title={`${currentJob.company} — ${currentJob.title}`}
        onBack={onBack}
        badge={{ label: sourceLabel, color: sourceColors.text, bg: sourceColors.bg }}
      />

      {/* Two-column layout */}
      <div className="focus-layout" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left — Job details */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, borderRight: '1px solid var(--color-border)', minHeight: 0, minWidth: 0 }}>
          <div style={{
            borderLeft: `4px solid ${borderColor}`,
            paddingLeft: 16, marginBottom: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <CompanyAvatar name={currentJob.company} logoUrl={currentJob.company_logo_url} size={48} />
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                  {currentJob.title}
                </h2>
                <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  {currentJob.company}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
              {currentJob.location}{salary && ` · ${salary}`}
            </div>
            {(currentJob.equity_min || currentJob.equity_max) && (
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                Equity: {currentJob.equity_min && currentJob.equity_max
                  ? `${currentJob.equity_min}%–${currentJob.equity_max}%`
                  : currentJob.equity_min
                    ? `${currentJob.equity_min}%+`
                    : `up to ${currentJob.equity_max}%`}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 24 }}>
            <StateActions job={currentJob} onAction={handleAction} />
          </div>

          <div
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--color-text-secondary)',
            }}
            className="job-description-markdown"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(marked.parse(currentJob.description_raw) as string, {
                ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote'],
                ALLOWED_ATTR: ['href', 'target', 'rel'],
              })
            }}
          />
        </div>

        {/* Right — Application details & timeline */}
        <div className="focus-sidebar" style={{ width: 'clamp(240px, 30vw, 360px)', overflowY: 'auto', padding: 24, minHeight: 0, flexShrink: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          {currentJob.is_live === false && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
              padding: '6px 10px', borderRadius: 6,
              background: 'var(--color-error-container)', border: '1px solid var(--color-error)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-error)' }}>Dead posting</span>
              {currentJob.liveness_checked_at && (
                <span style={{ fontSize: 11, color: 'var(--color-text-disabled)', marginLeft: 'auto' }}>
                  Checked {timeAgo(currentJob.liveness_checked_at)}
                </span>
              )}
            </div>
          )}

          {currentJob.state === 'docs-failed' && currentJob.docs_fail_reason && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, marginBottom: 12,
              background: 'var(--color-error-container)', border: '1px solid var(--color-error)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-error)', marginBottom: 4 }}>
                Doc generation failed
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
                {currentJob.docs_fail_reason}
              </div>
            </div>
          )}

          {application && (
            <>
              {application.ats_platform && (
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
                  ATS: <strong>{application.ats_platform}</strong>
                </div>
              )}

              {application.incomplete_fields && application.incomplete_fields.length > 0 && (
                <div style={{
                  padding: '8px 12px', borderRadius: 6, marginBottom: 12,
                  background: 'var(--color-warning-container)', border: '1px solid var(--color-warning)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-warning)', marginBottom: 4 }}>
                    Incomplete fields
                  </div>
                  {application.incomplete_fields.map((field) => (
                    <div key={field} style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      • {field}
                    </div>
                  ))}
                </div>
              )}

              {application.fill_notes && ['fill-failed', 'review-incomplete'].includes(currentJob.state) && (
                <div style={{
                  padding: '8px 12px', borderRadius: 6, marginBottom: 12,
                  background: 'var(--color-error-container)', border: '1px solid var(--color-error)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-error)', marginBottom: 4 }}>
                    Fill error
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {application.fill_notes}
                  </div>
                </div>
              )}

              {application.application_email && (
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
                  Email: <code style={{ fontSize: 11, background: 'var(--color-surface-raised)', padding: '1px 4px', borderRadius: 3 }}>
                    {application.application_email}
                  </code>
                </div>
              )}
            </>
          )}

          {/* Relevance Score — compact inline with expandable breakdown */}
          {currentJob.relevance_score !== null && currentJob.relevance_score !== undefined && (
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => setScoreBreakdownExpanded(e => !e)}
                aria-expanded={scoreBreakdownExpanded}
                aria-label={scoreBreakdownExpanded ? 'Hide score breakdown' : 'Show score breakdown'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                }}
              >
                <span style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: currentJob.relevance_score >= 80
                    ? 'var(--color-success)'
                    : currentJob.relevance_score >= 50
                      ? 'var(--color-warning)'
                      : 'var(--color-error)',
                }}>
                  {currentJob.relevance_score}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', flex: 1, textAlign: 'left' }}>
                  Match score
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-disabled)' }}>
                  {scoreBreakdownExpanded ? '▼' : '▶'}
                </span>
              </button>
              {scoreBreakdownExpanded && currentJob.score_breakdown && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 22 }}>
                  {currentJob.score_breakdown.match_highlights?.map((item) => (
                    <div key={item} style={{ fontSize: 11, color: 'var(--color-success)', display: 'flex', gap: 4 }}>
                      <span aria-hidden="true">+</span><span>Match: {item}</span>
                    </div>
                  ))}
                  {currentJob.score_breakdown.red_flags?.map((item) => (
                    <div key={item} style={{ fontSize: 11, color: 'var(--color-error)', display: 'flex', gap: 4 }}>
                      <span aria-hidden="true">-</span><span>Flag: {item}</span>
                    </div>
                  ))}
                  {currentJob.score_breakdown.reasons?.map((item) => (
                    <div key={item} style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 24, marginBottom: 12 }}>
            Timeline
          </h3>

          <TimelineEvent label="Discovered" date={currentJob.discovered_at} />
          {application?.queued_at && <TimelineEvent label="Queued" date={application.queued_at} />}
          {application?.fill_started_at && <TimelineEvent label="Fill started" date={application.fill_started_at} />}
          {application?.fill_completed_at && <TimelineEvent label="Fill completed" date={application.fill_completed_at} />}
          {application?.submitted_at && <TimelineEvent label="Submitted" date={application.submitted_at} />}

          {/* Callback Tracking */}
          {['submitted', 'tracking'].includes(currentJob.state) && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 24, marginBottom: 12 }}>
                Outcome
              </h3>
              {currentJob.state === 'submitted' && currentJob.got_callback === null ? (
                <OutcomeTracker
                  outcome={null}
                  notes={null}
                  positiveLabel="Got Callback"
                  negativeLabel="No Callback"
                  positiveDisplay="Received callback"
                  negativeDisplay="No callback yet"
                  onPositive={async (cbNotes) => {
                    await updateJobCallback(currentJob.id, true, cbNotes);
                    await refreshJobData();
                    toast.success('Callback recorded!');
                  }}
                  onNegative={async () => {
                    await updateJobCallback(currentJob.id, false, 'No callback received');
                    await refreshJobData();
                    toast.info('Marked as no callback');
                  }}
                />
              ) : (
                <OutcomeTracker
                  outcome={currentJob.got_callback}
                  notes={currentJob.callback_notes ?? null}
                  positiveLabel="Got Callback"
                  negativeLabel="No Callback"
                  positiveDisplay="Received callback"
                  negativeDisplay="No callback yet"
                  onPositive={async () => {}}
                  onNegative={async () => {}}
                />
              )}
            </>
          )}

          {draftAnswers.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 24, marginBottom: 12 }}>
                Draft Answers
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                {draftAnswers.map((qa) => (
                  <div key={qa.question}>
                    <div style={{
                      fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)',
                      marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px',
                    }}>
                      {qa.question}
                    </div>
                    <SharedTextArea
                      aria-label={`Answer for: ${qa.question}`}
                      value={qa.answer}
                      onChange={e => {
                        const updated = draftAnswers.map((item) =>
                          item.question === qa.question ? { ...item, answer: e.target.value } : item
                        );
                        setDraftAnswers(updated);
                      }}
                      style={{ minHeight: 72, padding: '8px 10px' }}
                    />
                  </div>
                ))}
              </div>
              <button
                disabled={draftAnswersSaving}
                onClick={async () => {
                  if (!application) return;
                  setDraftAnswersSaving(true);
                  try {
                    await updateApplicationDraftAnswers(application.id, draftAnswers);
                    toast.success('Draft answers saved');
                  } catch (err) {
                    toast.error((err as Error).message);
                  } finally {
                    setDraftAnswersSaving(false);
                  }
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: draftAnswersSaving ? 'not-allowed' : 'pointer',
                  opacity: draftAnswersSaving ? 0.6 : 1,
                }}
              >
                {draftAnswersSaving ? 'Saving…' : 'Save answers'}
              </button>
            </>
          )}

          {/* Pinned to bottom on low-info cards — expanding notes grows into scroll area, no layout shift */}
          <div style={{ marginTop: 'auto' }}>
            <ExpandableNotes
              value={notes}
              onChange={setNotes}
              onSave={(val) => {
                if (application) {
                  updateApplicationNotes(application.id, val).catch(err =>
                    logger.error('Failed to save notes', 'FocusMode', err)
                  );
                }
              }}
              placeholder="Add notes about this application..."
            />

            <div style={{ marginTop: 24 }}>
              <a
                href={currentJob.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12, color: 'var(--color-primary)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Open original listing
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: -1 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function TimelineEvent({ label, date }: { label: string; date: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: 'var(--color-text-disabled)', flexShrink: 0,
      }} />
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--color-text-disabled)', marginLeft: 'auto' }}>
        {timeAgo(date)}
      </span>
    </div>
  );
}
