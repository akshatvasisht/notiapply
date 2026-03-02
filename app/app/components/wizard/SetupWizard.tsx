'use client';

import { useState, useCallback } from 'react';
import { updateUserConfig, uploadMasterResume, uploadCoverLetterTemplate } from '@/lib/db';
import type { UserConfig } from '@/lib/types';

interface WizardProps {
    onComplete: () => void;
}

const STEPS = ['Resume', 'API Keys', 'Preferences', 'Confirm'];

export default function SetupWizard({ onComplete }: WizardProps) {
    const [step, setStep] = useState(0);
    const [config, setConfig] = useState<UserConfig>({
        search_terms: [],
        locations: [],
        github_repos: ['SimplifyJobs/New-Grad-Positions'],
        filter: { seniority: [], new_grad_only: false, exclude_keywords: [], require_keywords: [] },
    });
    const [resumeTeX, setResumeTeX] = useState('');
    const [coverTeX, setCoverTeX] = useState('');
    const [validations, setValidations] = useState<Record<string, 'pending' | 'pass' | 'fail'>>({});

    const updateConfig = useCallback((patch: Partial<UserConfig>) => {
        setConfig(prev => ({ ...prev, ...patch }));
    }, []);

    const handleFinish = async () => {
        if (resumeTeX) await uploadMasterResume(resumeTeX);
        if (coverTeX) await uploadCoverLetterTemplate(coverTeX);
        await updateUserConfig({ ...config, setup_complete: true });
        onComplete();
    };

    const canAdvance = () => {
        if (step === 0) return resumeTeX.length > 0;
        if (step === 1) return config.llm_endpoint && config.llm_api_key && config.ntfy_topic;
        if (step === 2) return (config.search_terms?.length ?? 0) > 0;
        return true;
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100vh', padding: 40,
            background: 'var(--color-surface)',
        }}>
            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
                {STEPS.map((s, i) => (
                    <div
                        key={s}
                        style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: i <= step ? 'var(--color-google-blue)' : 'var(--color-border)',
                            transition: 'background 0.2s',
                        }}
                    />
                ))}
            </div>

            <div style={{
                width: '100%', maxWidth: 520, minHeight: 400,
                background: 'var(--color-surface)', borderRadius: 12,
                border: '1px solid var(--color-border)', padding: 32,
            }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 0 }}>
                    {STEPS[step]}
                </h2>

                {step === 0 && (
                    <ResumeStep
                        resumeTeX={resumeTeX} onResume={setResumeTeX}
                        coverTeX={coverTeX} onCover={setCoverTeX}
                    />
                )}
                {step === 1 && (
                    <ApiKeysStep config={config} onChange={updateConfig} validations={validations} setValidations={setValidations} />
                )}
                {step === 2 && (
                    <PreferencesStep config={config} onChange={updateConfig} />
                )}
                {step === 3 && (
                    <ConfirmStep config={config} hasResume={!!resumeTeX} hasCover={!!coverTeX} />
                )}
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                {step > 0 && (
                    <button onClick={() => setStep(s => s - 1)} style={navBtn('outline')}>Back</button>
                )}
                {step < 3 ? (
                    <button
                        onClick={() => setStep(s => s + 1)}
                        disabled={!canAdvance()}
                        style={navBtn(canAdvance() ? 'primary' : 'disabled')}
                    >
                        Continue
                    </button>
                ) : (
                    <button onClick={handleFinish} style={navBtn('primary')}>
                        Launch Notiapply
                    </button>
                )}
            </div>
        </div>
    );
}

function navBtn(variant: 'primary' | 'outline' | 'disabled'): React.CSSProperties {
    const base: React.CSSProperties = {
        padding: '8px 24px', borderRadius: 6, fontSize: 13, fontWeight: 500,
        cursor: 'pointer', border: 'none', transition: 'all 0.15s',
    };
    if (variant === 'primary') return { ...base, background: 'var(--color-google-blue)', color: 'var(--color-text-inverse)' };
    if (variant === 'outline') return { ...base, background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' };
    return { ...base, background: 'var(--color-border)', color: 'var(--color-text-disabled)', cursor: 'not-allowed' };
}

// ─── Step 1: Resume Upload ─────────────────────────────────────────────────────

function ResumeStep({ resumeTeX, onResume, coverTeX, onCover }: {
    resumeTeX: string; onResume: (v: string) => void;
    coverTeX: string; onCover: (v: string) => void;
}) {
    const handleFile = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setter(reader.result as string);
        reader.readAsText(file);
    };

    return (
        <div>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                Upload your LaTeX resume. It must be single-column with no tables and contain a <code>% SKILLS_INJECT_POINT</code> comment.
            </p>
            <FileDropField
                label="Master Resume (.tex) *"
                accept=".tex"
                hasFile={!!resumeTeX}
                onChange={handleFile(onResume)}
            />
            <div style={{ marginTop: 16 }}>
                <FileDropField
                    label="Cover Letter Template (.tex) — optional"
                    accept=".tex"
                    hasFile={!!coverTeX}
                    onChange={handleFile(onCover)}
                />
            </div>
        </div>
    );
}

function FileDropField({ label, accept, hasFile, onChange }: {
    label: string; accept: string; hasFile: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
    return (
        <label style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '16px 20px', borderRadius: 8,
            border: `2px dashed ${hasFile ? 'var(--color-google-green)' : 'var(--color-border)'}`,
            background: hasFile ? 'var(--color-green-tint)' : 'var(--color-surface-raised)',
            cursor: 'pointer', transition: 'all 0.2s',
        }}>
            <span style={{ fontSize: 20 }}>{hasFile ? '✓' : '📄'}</span>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{label}</span>
            <input type="file" accept={accept} onChange={onChange} style={{ display: 'none' }} />
        </label>
    );
}

// ─── Step 2: API Keys ──────────────────────────────────────────────────────────

function ApiKeysStep({ config, onChange, validations, setValidations }: {
    config: UserConfig;
    onChange: (patch: Partial<UserConfig>) => void;
    validations: Record<string, 'pending' | 'pass' | 'fail'>;
    setValidations: (v: Record<string, 'pending' | 'pass' | 'fail'>) => void;
}) {
    const testEndpoint = async (key: string, url: string) => {
        setValidations({ ...validations, [key]: 'pending' });
        try {
            const resp = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
            setValidations({ ...validations, [key]: resp.ok ? 'pass' : 'fail' });
        } catch {
            setValidations({ ...validations, [key]: 'fail' });
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ValidatedField
                label="LLM Endpoint *"
                value={config.llm_endpoint ?? ''}
                onChange={v => onChange({ llm_endpoint: v })}
                placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
                status={validations['llm']}
                onTest={() => testEndpoint('llm', config.llm_endpoint ?? '')}
            />
            <InputField label="LLM API Key *" value={config.llm_api_key ?? ''} onChange={v => onChange({ llm_api_key: v })} type="password" />
            <InputField label="LLM Model" value={config.llm_model ?? 'gemini-1.5-flash'} onChange={v => onChange({ llm_model: v })} />
            <InputField label="ntfy.sh Topic *" value={config.ntfy_topic ?? ''} onChange={v => onChange({ ntfy_topic: v })} placeholder="notiapply-abc123" />
            <InputField label="GitHub Token (optional)" value={config.github_token ?? ''} onChange={v => onChange({ github_token: v })} type="password" />
            <InputField label="Decodo Proxy (optional)" value={config.decodo_proxy ?? ''} onChange={v => onChange({ decodo_proxy: v })} placeholder="user:pass@gate.decodo.com:7000" />
        </div>
    );
}

// ─── Step 3: Preferences ───────────────────────────────────────────────────────

function PreferencesStep({ config, onChange }: {
    config: UserConfig; onChange: (patch: Partial<UserConfig>) => void;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <TagField
                label="Search Terms *"
                tags={config.search_terms ?? []}
                onChange={tags => onChange({ search_terms: tags })}
                placeholder="e.g. software engineer"
            />
            <TagField
                label="Locations"
                tags={config.locations ?? []}
                onChange={tags => onChange({ locations: tags })}
                placeholder="e.g. Remote, San Francisco"
            />
            <TagField
                label="GitHub Repos"
                tags={config.github_repos ?? []}
                onChange={tags => onChange({ github_repos: tags })}
                placeholder="e.g. SimplifyJobs/New-Grad-Positions"
            />
            <TagField
                label="Exclude Keywords"
                tags={config.filter?.exclude_keywords ?? []}
                onChange={tags => onChange({ filter: { ...config.filter, exclude_keywords: tags } })}
                placeholder="e.g. senior, staff, principal"
            />
        </div>
    );
}

// ─── Step 4: Confirm ───────────────────────────────────────────────────────────

function ConfirmStep({ config, hasResume, hasCover }: {
    config: UserConfig; hasResume: boolean; hasCover: boolean;
}) {
    const rows = [
        ['Resume', hasResume ? '✓ Uploaded' : '✗ Missing'],
        ['Cover Letter', hasCover ? '✓ Uploaded' : '— Skipped'],
        ['LLM Endpoint', config.llm_endpoint ?? '—'],
        ['LLM Model', config.llm_model ?? 'gemini-1.5-flash'],
        ['ntfy Topic', config.ntfy_topic ?? '—'],
        ['Search Terms', config.search_terms?.join(', ') ?? '—'],
        ['Locations', config.locations?.join(', ') ?? '—'],
        ['GitHub Repos', config.github_repos?.join(', ') ?? '—'],
        ['Proxy', config.decodo_proxy ? '✓ Configured' : '— None'],
    ];

    return (
        <div>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                Review your configuration before launching.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map(([label, value]) => (
                    <div key={label} style={{
                        display: 'flex', justifyContent: 'space-between', fontSize: 13,
                        padding: '6px 0', borderBottom: '1px solid var(--color-border)',
                    }}>
                        <span style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 500, textAlign: 'right', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Shared Form Components ────────────────────────────────────────────────────

function InputField({ label, value, onChange, type = 'text', placeholder }: {
    label: string; value: string; onChange: (v: string) => void;
    type?: string; placeholder?: string;
}) {
    return (
        <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6,
                    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                    color: 'var(--color-text-primary)', outline: 'none',
                    boxSizing: 'border-box',
                }}
            />
        </div>
    );
}

function ValidatedField({ label, value, onChange, placeholder, status, onTest }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; status?: 'pending' | 'pass' | 'fail';
    onTest: () => void;
}) {
    const indicator = status === 'pass' ? '✓' : status === 'fail' ? '✗' : status === 'pending' ? '…' : '';
    const indicatorColor = status === 'pass' ? 'var(--color-google-green)' : status === 'fail' ? 'var(--color-google-red)' : 'var(--color-text-tertiary)';

    return (
        <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
                {label} {indicator && <span style={{ color: indicatorColor }}>{indicator}</span>}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onBlur={onTest}
                    placeholder={placeholder}
                    style={{
                        flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 6,
                        border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                        color: 'var(--color-text-primary)', outline: 'none',
                    }}
                />
                <button
                    onClick={onTest}
                    style={{
                        padding: '8px 12px', borderRadius: 6, fontSize: 12,
                        background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)', cursor: 'pointer',
                    }}
                >
                    Test
                </button>
            </div>
        </div>
    );
}

function TagField({ label, tags, onChange, placeholder }: {
    label: string; tags: string[]; onChange: (tags: string[]) => void; placeholder?: string;
}) {
    const [input, setInput] = useState('');

    const addTag = () => {
        const v = input.trim();
        if (v && !tags.includes(v)) {
            onChange([...tags, v]);
        }
        setInput('');
    };

    return (
        <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
                {label}
            </label>
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 6,
                padding: '6px 8px', borderRadius: 6,
                border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                minHeight: 36,
            }}>
                {tags.map(tag => (
                    <span key={tag} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 4, fontSize: 12,
                        background: 'var(--color-blue-tint)', color: 'var(--color-google-blue)',
                    }}>
                        {tag}
                        <button
                            onClick={() => onChange(tags.filter(t => t !== tag))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, padding: 0, lineHeight: 1 }}
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    onBlur={addTag}
                    placeholder={tags.length === 0 ? placeholder : ''}
                    style={{
                        flex: 1, minWidth: 100, border: 'none', outline: 'none',
                        fontSize: 13, background: 'transparent', color: 'var(--color-text-primary)',
                    }}
                />
            </div>
        </div>
    );
}
