'use client';

import { useState } from 'react';

export function TagFieldInline({ label, tags, onChange }: { label: string; tags: string[]; onChange: (t: string[]) => void }) {
    const [input, setInput] = useState('');
    const inputId = `tag-field-${label.toLowerCase().replace(/\s+/g, '-')}`;
    const addTag = () => { const v = input.trim(); if (v && !tags.includes(v)) onChange([...tags, v]); setInput(''); };
    return (
        <div style={{ marginBottom: 12 }}>
            <label htmlFor={inputId} style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>{label}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', minHeight: 36 }}>
                {tags.map(t => (
                    <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 12, background: 'var(--color-primary-container)', color: 'var(--color-primary)' }}>
                        {t}
                        <button onClick={() => onChange(tags.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16, padding: 0, lineHeight: 1 }} aria-label={`Remove ${t}`}>×</button>
                    </span>
                ))}
                <input id={inputId} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} onBlur={addTag}
                    style={{ flex: 1, minWidth: 80, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: 'var(--color-text-primary)' }} />
            </div>
        </div>
    );
}
