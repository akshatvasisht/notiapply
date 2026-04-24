'use client';

import { useState } from 'react';
import SharedTextArea from './SharedTextArea';

interface ExpandableNotesProps {
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  placeholder?: string;
}

export default function ExpandableNotes({ value, onChange, onSave, placeholder = 'Add notes...' }: ExpandableNotesProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Hide notes' : 'Show notes'}
        style={{
          width: '100%',
          padding: '6px 10px',
          borderRadius: 6,
          border: '1px solid var(--color-outline-variant)',
          background: 'var(--color-surface-raised)',
          color: 'var(--color-on-surface)',
          fontSize: 12,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span aria-hidden="true">{expanded ? '▼' : '▶'}</span>
        {' '}{expanded ? 'Hide notes' : 'Notes'}
      </button>
      {expanded && (
        <div style={{ marginTop: 6 }}>
          <SharedTextArea
            aria-label="Notes"
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={() => onSave(value)}
            placeholder={placeholder}
          />
        </div>
      )}
    </div>
  );
}
