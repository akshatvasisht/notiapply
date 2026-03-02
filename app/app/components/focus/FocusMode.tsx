'use client';

import { useEffect, useState } from 'react';
import type { Job, Application } from '@/lib/types';
import { getApplicationByJobId, updateJobState } from '@/lib/db';
import { SOURCE_LABELS, SOURCE_COLORS, getCardBorderColor } from '@/lib/types';

interface FocusModeProps {
  job: Job;
  onBack: () => void;
}

import { timeAgo, formatSalary } from '@/lib/utils';

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
          <ActionButton label="✓ Mark Submitted" color="var(--color-google-green)" onClick={() => onAction('submitted')} />
          <ActionButton label="Reject" color="var(--color-google-red)" onClick={() => onAction('rejected')} />
        </div>
      );
    case 'review-incomplete':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton label="✓ Mark Submitted" color="var(--color-google-green)" onClick={() => onAction('submitted')} />
          <ActionButton label="Reject" color="var(--color-google-red)" onClick={() => onAction('rejected')} />
          <ActionButton label="Re-queue" color="var(--color-google-blue)" onClick={() => onAction('queued')} />
        </div>
      );
    case 'fill-failed':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton label="Re-queue" color="var(--color-google-blue)" onClick={() => onAction('queued')} />
          <ActionButton label="Archive" color="var(--color-text-tertiary)" onClick={() => onAction('filtered-out')} />
        </div>
      );
    case 'submitted':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton label="Track" color="var(--color-google-green)" onClick={() => onAction('tracking')} />
          <ActionButton label="Rejected" color="var(--color-google-red)" onClick={() => onAction('rejected')} />
        </div>
      );
    default:
      return null;
  }
}

function ActionButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
        background: 'transparent', color, border: `1px solid ${color}`,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = 'var(--color-text-inverse)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = color; }}
    >
      {label}
    </button>
  );
}

export default function FocusMode({ job, onBack }: FocusModeProps) {
  const [application, setApplication] = useState<Application | null>(null);
  const [currentJob, setCurrentJob] = useState(job);

  useEffect(() => {
    getApplicationByJobId(job.id).then(setApplication).catch(console.error);
  }, [job.id]);

  const handleAction = async (newState: string) => {
    await updateJobState(currentJob.id, newState);
    setCurrentJob({ ...currentJob, state: newState as Job['state'] });
  };

  const salary = formatSalary(currentJob.salary_min, currentJob.salary_max);
  const sourceColors = SOURCE_COLORS[currentJob.source] ?? { text: 'var(--color-text-tertiary)', bg: 'var(--color-surface-raised)' };
  const sourceLabel = SOURCE_LABELS[currentJob.source] ?? currentJob.source;
  const borderColor = getCardBorderColor(currentJob.state);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        height: 44, padding: '0 16px',
        background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 16, color: 'var(--color-text-secondary)', padding: '4px 8px',
          }}
        >
          ← Back
        </button>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {currentJob.company} — {currentJob.title}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
          color: sourceColors.text, background: sourceColors.bg,
        }}>
          {sourceLabel}
        </span>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left — Job details */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, borderRight: '1px solid var(--color-border)' }}>
          <div style={{
            borderLeft: `4px solid ${borderColor}`,
            paddingLeft: 16, marginBottom: 24,
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
              {currentJob.title}
            </h2>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {currentJob.company}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
              {currentJob.location}{salary && ` · ${salary}`}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <StateActions job={currentJob} onAction={handleAction} />
          </div>

          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
            {currentJob.description_raw}
          </div>
        </div>

        {/* Right — Application details & timeline */}
        <div style={{ width: 360, overflowY: 'auto', padding: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 0, marginBottom: 16 }}>
            Status
          </h3>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
            padding: '8px 12px', borderRadius: 6,
            background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: borderColor }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {currentJob.state.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())}
            </span>
          </div>

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
                  background: 'var(--color-yellow-tint)', border: '1px solid var(--color-google-yellow)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-google-yellow)', marginBottom: 4 }}>
                    Incomplete fields
                  </div>
                  {application.incomplete_fields.map((field, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      • {field}
                    </div>
                  ))}
                </div>
              )}

              {application.fill_notes && (
                <div style={{
                  padding: '8px 12px', borderRadius: 6, marginBottom: 12,
                  background: 'var(--color-red-tint)', border: '1px solid var(--color-google-red)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-google-red)', marginBottom: 4 }}>
                    Error
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

          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 24, marginBottom: 12 }}>
            Timeline
          </h3>

          <TimelineEvent label="Discovered" date={currentJob.discovered_at} />
          {application?.queued_at && <TimelineEvent label="Queued" date={application.queued_at} />}
          {application?.fill_started_at && <TimelineEvent label="Fill started" date={application.fill_started_at} />}
          {application?.fill_completed_at && <TimelineEvent label="Fill completed" date={application.fill_completed_at} />}
          {application?.submitted_at && <TimelineEvent label="Submitted" date={application.submitted_at} />}

          <div style={{ marginTop: 24 }}>
            <a
              href={currentJob.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12, color: 'var(--color-google-blue)',
                textDecoration: 'none',
              }}
            >
              Open original listing ↗
            </a>
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
