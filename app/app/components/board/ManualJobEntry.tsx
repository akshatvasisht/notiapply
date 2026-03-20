'use client';

import { useState } from 'react';
import Modal from '../common/Modal';
import { addManualJob } from '@/lib/db';

interface ManualJobEntryProps {
    onClose: () => void;
    onSuccess: (count: number) => void;
}

type Tab = 'single' | 'csv' | 'urls';

interface JobFormData {
    title: string;
    company: string;
    url: string;
    location: string;
    description: string;
}

export default function ManualJobEntry({ onClose, onSuccess }: ManualJobEntryProps) {
    const [activeTab, setActiveTab] = useState<Tab>('single');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Single entry form state
    const [formData, setFormData] = useState<JobFormData>({
        title: '',
        company: '',
        url: '',
        location: '',
        description: '',
    });

    // CSV import state
    const [csvText, setCsvText] = useState('');

    // Bulk URLs state
    const [urlsText, setUrlsText] = useState('');

    const handleSingleSubmit = async () => {
        setError(null);

        // Validation
        if (!formData.title.trim() || !formData.company.trim() || !formData.url.trim()) {
            setError('Title, Company, and URL are required');
            return;
        }

        setSubmitting(true);
        try {
            await addManualJob({
                title: formData.title.trim(),
                company: formData.company.trim(),
                url: formData.url.trim(),
                location: formData.location.trim(),
                description: formData.description.trim(),
            });
            onSuccess(1);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add job');
        } finally {
            setSubmitting(false);
        }
    };

    const parseCSV = (text: string): JobFormData[] => {
        const lines: string[] = [];
        let current = '';
        let inQuotes = false;

        // Parse CSV with quoted field support
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === '\n' && !inQuotes) {
                if (current.trim()) lines.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        if (current.trim()) lines.push(current);

        const jobs: JobFormData[] = [];

        // Skip header if it looks like one
        const startIdx = lines[0]?.toLowerCase().includes('title') ? 1 : 0;

        for (let i = startIdx; i < lines.length; i++) {
            const fields: string[] = [];
            let field = '';
            let quoted = false;

            for (let j = 0; j < lines[i].length; j++) {
                const char = lines[i][j];
                if (char === '"') {
                    quoted = !quoted;
                } else if (char === ',' && !quoted) {
                    fields.push(field.trim());
                    field = '';
                } else {
                    field += char;
                }
            }
            fields.push(field.trim());

            if (fields.length >= 3 && fields[0] && fields[1] && fields[2]) {
                jobs.push({
                    title: fields[0],
                    company: fields[1],
                    url: fields[2],
                    location: fields[3] || '',
                    description: fields[4] || '',
                });
            }
        }

        return jobs;
    };

    const handleCSVSubmit = async () => {
        setError(null);
        if (!csvText.trim()) {
            setError('Please paste CSV data');
            return;
        }

        const jobs = parseCSV(csvText);
        if (jobs.length === 0) {
            setError('No valid jobs found in CSV. Format: title,company,url,location,description');
            return;
        }

        setSubmitting(true);
        try {
            for (const job of jobs) {
                await addManualJob(job);
            }
            onSuccess(jobs.length);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import jobs');
        } finally {
            setSubmitting(false);
        }
    };

    const handleURLsSubmit = async () => {
        setError(null);
        const urls = urlsText.split('\n').map(u => u.trim()).filter(Boolean);

        if (urls.length === 0) {
            setError('Please paste at least one URL');
            return;
        }

        setSubmitting(true);
        try {
            for (const url of urls) {
                // Extract basic info from URL
                const domain = new URL(url).hostname.replace('www.', '');
                const companyGuess = domain.split('.')[0];

                await addManualJob({
                    title: 'Manual Entry (Edit Required)',
                    company: companyGuess.charAt(0).toUpperCase() + companyGuess.slice(1),
                    url,
                    location: 'Remote',
                    description: `Imported from URL: ${url}`,
                });
            }
            onSuccess(urls.length);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to import URLs');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = () => {
        if (activeTab === 'single') handleSingleSubmit();
        else if (activeTab === 'csv') handleCSVSubmit();
        else handleURLsSubmit();
    };

    return (
        <Modal onClose={onClose} width="600px">
            {/* Header */}
            <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
            }}>
                <h2 style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    letterSpacing: '-0.01em',
                }}>
                    Add Jobs Manually
                </h2>
                <p style={{
                    margin: '6px 0 0 0',
                    fontSize: 13,
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.5,
                }}>
                    Import jobs via single entry, CSV, or bulk URLs
                </p>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: 0,
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                padding: '0 24px',
            }}>
                {([
                    { key: 'single' as Tab, label: 'Single Entry', icon: '✎' },
                    { key: 'csv' as Tab, label: 'CSV Import', icon: '⊞' },
                    { key: 'urls' as Tab, label: 'Bulk URLs', icon: '⋮' },
                ] as const).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '12px 16px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
                            color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            fontSize: 13,
                            fontWeight: activeTab === tab.key ? 600 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <span style={{ opacity: 0.7, fontSize: 14 }}>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 24,
                background: 'var(--color-surface-raised)',
            }}>
                {activeTab === 'single' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <InputField
                            label="Job Title"
                            required
                            value={formData.title}
                            onChange={v => setFormData(prev => ({ ...prev, title: v }))}
                            placeholder="Software Engineer"
                        />
                        <InputField
                            label="Company"
                            required
                            value={formData.company}
                            onChange={v => setFormData(prev => ({ ...prev, company: v }))}
                            placeholder="Anthropic"
                        />
                        <InputField
                            label="URL"
                            required
                            value={formData.url}
                            onChange={v => setFormData(prev => ({ ...prev, url: v }))}
                            placeholder="https://..."
                        />
                        <InputField
                            label="Location"
                            value={formData.location}
                            onChange={v => setFormData(prev => ({ ...prev, location: v }))}
                            placeholder="San Francisco, CA"
                        />
                        <div>
                            <label htmlFor="job-description" style={{
                                display: 'block',
                                fontSize: 12,
                                fontWeight: 600,
                                color: 'var(--color-text-secondary)',
                                marginBottom: 6,
                                letterSpacing: '0.02em',
                                textTransform: 'uppercase',
                            }}>
                                Description
                            </label>
                            <textarea
                                id="job-description"
                                value={formData.description}
                                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Job description or notes..."
                                style={{
                                    width: '100%',
                                    minHeight: 100,
                                    padding: '10px 12px',
                                    fontSize: 14,
                                    fontFamily: 'inherit',
                                    border: '1px solid var(--color-outline-variant)',
                                    borderRadius: 8,
                                    background: 'var(--color-surface)',
                                    color: 'var(--color-text-primary)',
                                    resize: 'vertical',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                                onBlur={e => e.target.style.borderColor = 'var(--color-outline-variant)'}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'csv' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{
                            padding: 12,
                            background: 'var(--color-primary-container)',
                            borderRadius: 8,
                            fontSize: 12,
                            color: 'var(--color-primary)',
                            lineHeight: 1.6,
                        }}>
                            <strong style={{ display: 'block', marginBottom: 4 }}>CSV Format:</strong>
                            <code style={{ opacity: 0.9 }}>title,company,url,location,description</code>
                            <div style={{ marginTop: 6, opacity: 0.8 }}>
                                First row can be headers. Use quotes for fields with commas.
                            </div>
                        </div>
                        <textarea
                            id="csv-input"
                            aria-label="CSV job data input"
                            value={csvText}
                            onChange={e => setCsvText(e.target.value)}
                            placeholder={'Senior Engineer,Anthropic,https://anthropic.com/jobs/123,San Francisco,AI Safety research\n"ML Engineer, Applied",OpenAI,https://openai.com/careers/ml,Remote,"Build GPT models"'}
                            style={{
                                width: '100%',
                                minHeight: 280,
                                padding: '12px 14px',
                                fontSize: 13,
                                fontFamily: 'ui-monospace, monospace',
                                border: '1px solid var(--color-outline-variant)',
                                borderRadius: 8,
                                background: 'var(--color-surface)',
                                color: 'var(--color-text-primary)',
                                lineHeight: 1.6,
                                resize: 'vertical',
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--color-outline-variant)'}
                        />
                    </div>
                )}

                {activeTab === 'urls' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{
                            padding: 12,
                            background: 'var(--color-warning-container)',
                            borderRadius: 8,
                            fontSize: 12,
                            color: 'var(--color-warning)',
                            lineHeight: 1.6,
                        }}>
                            <strong style={{ display: 'block', marginBottom: 4 }}>Quick Import</strong>
                            Paste job URLs (one per line). Jobs will be created with placeholder data
                            that you can edit later in the board.
                        </div>
                        <textarea
                            id="urls-input"
                            aria-label="Job URLs input"
                            value={urlsText}
                            onChange={e => setUrlsText(e.target.value)}
                            placeholder={'https://greenhouse.io/company/role1\nhttps://lever.co/company/role2\nhttps://jobs.ashbyhq.com/company/role3'}
                            style={{
                                width: '100%',
                                minHeight: 280,
                                padding: '12px 14px',
                                fontSize: 13,
                                fontFamily: 'ui-monospace, monospace',
                                border: '1px solid var(--color-outline-variant)',
                                borderRadius: 8,
                                background: 'var(--color-surface)',
                                color: 'var(--color-text-primary)',
                                lineHeight: 1.8,
                                resize: 'vertical',
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--color-outline-variant)'}
                        />
                    </div>
                )}

                {error && (
                    <div style={{
                        marginTop: 16,
                        padding: '10px 14px',
                        background: 'var(--color-error-container)',
                        color: 'var(--color-error)',
                        borderRadius: 8,
                        fontSize: 13,
                        lineHeight: 1.5,
                    }}>
                        {error}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
            }}>
                <button
                    onClick={onClose}
                    disabled={submitting}
                    style={{
                        padding: '8px 18px',
                        fontSize: 13,
                        fontWeight: 500,
                        border: '1px solid var(--color-outline-variant)',
                        borderRadius: 8,
                        background: 'transparent',
                        color: 'var(--color-text-secondary)',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                        padding: '8px 24px',
                        fontSize: 13,
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: 8,
                        background: submitting ? 'var(--color-text-disabled)' : 'var(--color-primary)',
                        color: 'var(--color-text-inverse)',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: submitting ? 'scale(0.98)' : 'scale(1)',
                    }}
                >
                    {submitting ? 'Adding...' : activeTab === 'single' ? 'Add Job' : 'Import Jobs'}
                </button>
            </div>
        </Modal>
    );
}

function InputField({
    label,
    value,
    onChange,
    placeholder,
    required = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
}) {
    return (
        <div>
            <label style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                marginBottom: 6,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
            }}>
                {label}
                {required && <span style={{ color: 'var(--color-error)', marginLeft: 3 }}>*</span>}
            </label>
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 14,
                    border: '1px solid var(--color-outline-variant)',
                    borderRadius: 8,
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--color-outline-variant)'}
            />
        </div>
    );
}
