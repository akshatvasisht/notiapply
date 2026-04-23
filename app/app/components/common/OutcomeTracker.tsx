'use client';

import { useState } from 'react';
import SharedTextArea from './SharedTextArea';

interface OutcomeTrackerProps {
  outcome: boolean | null;
  notes: string | null;
  positiveLabel: string;
  negativeLabel: string;
  positiveDisplay: string;
  negativeDisplay: string;
  onPositive: (notes: string) => Promise<void>;
  onNegative: () => Promise<void>;
  saving?: boolean;
}

export default function OutcomeTracker({
  outcome,
  notes,
  positiveLabel,
  negativeLabel,
  positiveDisplay,
  negativeDisplay,
  onPositive,
  onNegative,
  saving = false,
}: OutcomeTrackerProps) {
  const [showInput, setShowInput] = useState(false);
  const [inputNotes, setInputNotes] = useState('');
  const [localSaving, setLocalSaving] = useState(false);

  const isSaving = saving || localSaving;

  // Display state: outcome already recorded
  if (outcome !== null) {
    return (
      <div style={{
        padding: '8px 14px',
        borderRadius: 6,
        background: outcome
          ? 'var(--color-success-container)'
          : 'var(--color-surface-raised)',
        border: outcome
          ? '1px solid var(--color-success-border)'
          : '1px solid var(--color-border)',
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 500,
          color: outcome
            ? 'var(--color-success)'
            : 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: outcome && notes ? 6 : 0,
        }}>
          <span style={{ fontSize: 13, lineHeight: 1 }}>
            {outcome ? '✓' : '○'}
          </span>
          {outcome ? positiveDisplay : negativeDisplay}
        </div>

        {outcome && notes && (
          <div style={{
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            paddingLeft: 19,
            lineHeight: 1.5,
          }}>
            {notes}
          </div>
        )}
      </div>
    );
  }

  // Interactive state: awaiting user input
  return (
    <>
      <div style={{
        padding: '10px 14px',
        background: 'var(--color-surface-raised)',
        borderRadius: 6,
        border: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
            whiteSpace: 'nowrap',
          }}>
            Response?
          </span>
          <button
            className="outcome-btn-yes"
            disabled={isSaving}
            onClick={() => {
              if (isSaving) return;
              setShowInput(true);
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: 'none',
              background: 'var(--color-success)',
              color: 'var(--color-on-success)',
              fontSize: 11,
              fontWeight: 500,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            ✓ {positiveLabel}
          </button>
          <button
            className="outcome-btn-no"
            disabled={isSaving}
            onClick={async () => {
              if (isSaving) return;
              setLocalSaving(true);
              try {
                await onNegative();
              } finally {
                setLocalSaving(false);
              }
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              fontSize: 11,
              fontWeight: 500,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {negativeLabel}
          </button>
        </div>
        {showInput && (
          <div style={{ marginTop: 10 }}>
            <SharedTextArea
              aria-label="Outcome notes"
              value={inputNotes}
              onChange={e => setInputNotes(e.target.value)}
              placeholder="What happened? (optional)"
              style={{ minHeight: 60, padding: '6px 8px', marginBottom: 6, fontSize: 11 }}
            />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                disabled={isSaving}
                onClick={async () => {
                  if (isSaving) return;
                  setLocalSaving(true);
                  try {
                    await onPositive(inputNotes);
                    setShowInput(false);
                    setInputNotes('');
                  } finally {
                    setLocalSaving(false);
                  }
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 4,
                  border: 'none',
                  background: 'var(--color-success)',
                  color: 'var(--color-on-success)',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                {isSaving ? 'Saving\u2026' : 'Confirm'}
              </button>
              <button
                onClick={() => { setShowInput(false); setInputNotes(''); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 4,
                  border: 'none',
                  background: 'none',
                  color: 'var(--color-text-secondary)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
