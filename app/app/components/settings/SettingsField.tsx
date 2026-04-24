'use client';

import { useState } from 'react';

export function Field({ label, value, onChange, type = 'text', placeholder }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
    const inputId = `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
    return (
        <div style={{ marginBottom: 12 }}>
            <label htmlFor={inputId} style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-on-surface-variant)',
                display: 'block',
                marginBottom: 4,
            }}>
                {label}
            </label>
            <input
                id={inputId}
                value={value}
                onChange={e => onChange(e.target.value)}
                type={type}
                placeholder={placeholder}
                style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 13,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-outline-variant)',
                    background: 'var(--color-surface-container)',
                    color: 'var(--color-on-surface)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-outline-variant)'}
            />
        </div>
    );
}

export function FieldWithTest({ label, value, onChange, type = 'text', placeholder, onTest }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; onTest: () => Promise<boolean>;
}) {
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
    const inputId = `field-test-${label.toLowerCase().replace(/\s+/g, '-')}`;

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        const result = await onTest();
        setTestResult(result ? 'success' : 'error');
        setTesting(false);
        setTimeout(() => setTestResult(null), 3000);
    };

    return (
        <div style={{ marginBottom: 12 }}>
            <label htmlFor={inputId} style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-on-surface-variant)',
                display: 'block',
                marginBottom: 4,
            }}>
                {label}
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                    id={inputId}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    type={type}
                    placeholder={placeholder}
                    style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: 13,
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${testResult === 'error' ? 'var(--color-error)' : testResult === 'success' ? 'var(--color-success)' : 'var(--color-outline-variant)'}`,
                        background: 'var(--color-surface-container)',
                        color: 'var(--color-on-surface)',
                        outline: 'none',
                        transition: 'border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onFocus={(e) => {
                        if (!testResult) e.currentTarget.style.borderColor = 'var(--color-primary)';
                    }}
                    onBlur={(e) => {
                        if (!testResult) e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
                    }}
                />
                <button
                    onClick={handleTest}
                    disabled={testing || !value}
                    style={{
                        padding: '8px 14px',
                        fontSize: 12,
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: testing || !value ? 'var(--color-surface-container-low)' : 'var(--color-primary)',
                        color: testing || !value ? 'var(--color-on-surface-disabled)' : 'var(--color-on-primary)',
                        cursor: testing || !value ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                        minWidth: 60,
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        opacity: testing || !value ? 0.5 : 1,
                    }}
                >
                    {testing ? '...' : 'Test'}
                </button>
                {testResult && (
                    <span
                        role="status"
                        aria-label={testResult === 'success' ? 'Test passed' : 'Test failed'}
                        style={{
                            fontSize: 16,
                            color: testResult === 'success' ? 'var(--color-success)' : 'var(--color-error)',
                        }}
                    >
                        {testResult === 'success' ? '✓' : '✗'}
                    </span>
                )}
            </div>
        </div>
    );
}
