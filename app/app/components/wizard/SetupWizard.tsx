'use client';

import { useState, useCallback } from 'react';
import { uploadMasterResume, uploadCoverLetterTemplate, hasDatabase } from '@/lib/db';
import { updateSecureConfig } from '@/lib/secure-config';
import type { UserConfig } from '@/lib/types';
import { logger } from '@/lib/logger';

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
        await updateSecureConfig({ ...config, setup_complete: true });
        onComplete();
    };

    // DEV ONLY: Skip wizard with mock data
    const handleDevSkip = () => {
        const mockConfig: UserConfig = {
            llm_endpoint: 'https://api.example.com/v1',
            llm_api_key: 'mock-api-key',
            llm_model: 'gemini-1.5-flash',
            search_terms: ['software engineer', 'backend engineer'],
            locations: ['Remote', 'San Francisco'],
            github_repos: ['SimplifyJobs/New-Grad-Positions'],
            filter: { exclude_keywords: ['senior'], seniority: ['entry'], new_grad_only: false },
            setup_complete: true,
        };
        // Fire-and-forget — skip DB write entirely in demo mode (no DATABASE_URL).
        if (hasDatabase()) {
            updateSecureConfig(mockConfig).catch(err =>
                logger.warn('DB unavailable, skipping wizard config save', 'SetupWizard', err)
            );
        }
        onComplete();
    };

    const canAdvance = () => {
        if (step === 0) return resumeTeX.length > 0;
        if (step === 1) return config.llm_endpoint && config.llm_api_key;
        if (step === 2) return (config.search_terms?.length ?? 0) > 0;
        return true;
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '24px 40px',
            background: 'var(--color-surface)',
            overflowY: 'auto',
        }}>
            {/* Skip button — rendered only when no DB is reachable (DATABASE_URL
                unset or pool uninitialized). In that mode the wizard's real
                persistence path would fail anyway; the skip lets users preview
                the UI with mock data. Hidden automatically once a DB is wired. */}
            {!hasDatabase() && (
                <button
                    onClick={handleDevSkip}
                    className="wizard-button"
                    style={{
                        position: 'absolute',
                        top: 20,
                        right: 20,
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 11,
                        background: 'var(--color-warning-container)',
                        color: 'var(--color-warning)',
                        border: '1px solid var(--color-warning)',
                        cursor: 'pointer',
                        fontWeight: 500,
                        letterSpacing: '0.5px',
                    }}
                    title="No DB detected — skip setup with mock data to preview the UI"
                    aria-label="Skip setup with mock data (no database detected)"
                >
                    Preview without DB
                </button>
            )}

            {/* Landmark heading for assistive tech — visually hidden so the
                card's step title remains the primary visual anchor. */}
            <h1 className="sr-only">Notiapply Setup — Step {step + 1} of {STEPS.length}: {STEPS[step]}</h1>

            {/* Centered container for dots and card */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                maxWidth: 520,
            }}>
                {/* Progress dots — semantic ordered list so screen readers
                    announce step position + the current step. */}
                <ol
                    aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
                    style={{
                        display: 'flex',
                        gap: 8,
                        marginBottom: 32,
                        padding: 0,
                        listStyle: 'none',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {STEPS.map((s, i) => (
                        <li
                            key={s}
                            aria-current={i === step ? 'step' : undefined}
                            aria-label={`${s}${i < step ? ' (complete)' : i === step ? ' (current)' : ''}`}
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: 'var(--radius-full)',
                                background: i <= step ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                                transition: 'background 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                        />
                    ))}
                </ol>

                {/* Content card — inline `padding` supplies the default;
                    `.wizard-card` media-query override shrinks it on narrow viewports. */}
                <div
                    className="wizard-card"
                    style={{
                        width: '100%',
                        minHeight: 400,
                        background: 'var(--color-surface-container)',
                        borderRadius: 'var(--radius-xl)',
                        border: '1px solid var(--color-outline-variant)',
                        boxShadow: 'var(--elevation-1)',
                        padding: '24px 28px',
                    }}
                >
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
                <div style={{
                    display: 'flex',
                    gap: 12,
                    marginTop: 24,
                    width: '100%',
                    justifyContent: 'center',
                }}>
                    {step > 0 && (
                        <button
                            onClick={() => setStep(s => s - 1)}
                            className="wizard-button"
                            style={navBtn('outline')}
                        >
                            Back
                        </button>
                    )}
                    {step < 3 ? (
                        <button
                            onClick={() => setStep(s => s + 1)}
                            disabled={!canAdvance()}
                            className="wizard-button"
                            style={navBtn(canAdvance() ? 'primary' : 'disabled')}
                        >
                            Continue
                        </button>
                    ) : (
                        <button
                            onClick={handleFinish}
                            className="wizard-button"
                            style={navBtn('primary')}
                        >
                            Launch Notiapply
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function navBtn(variant: 'primary' | 'outline' | 'disabled'): React.CSSProperties {
    const base: React.CSSProperties = {
        padding: '12px 28px',           // min-height ~44px for WCAG 2.5.5 touch-target
        minHeight: 44,
        borderRadius: 'var(--radius-pill)',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        border: 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        letterSpacing: '0.5px',
    };
    if (variant === 'primary') {
        return {
            ...base,
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            boxShadow: 'var(--elevation-1)',
        };
    }
    if (variant === 'outline') {
        return {
            ...base,
            background: 'transparent',
            color: 'var(--color-on-surface)',
            border: '1px solid var(--color-outline)',
        };
    }
    // disabled — `--color-on-surface-disabled` already signals the state;
    // dropping `opacity: 0.5` keeps the text readable vs. the container.
    return {
        ...base,
        background: 'var(--color-surface-container-low)',
        color: 'var(--color-on-surface-disabled)',
        border: '1px solid var(--color-outline-variant)',
        cursor: 'not-allowed',
    };
}

// ─── Step 1: Resume Upload ─────────────────────────────────────────────────────

// Validation rules: lax on whitespace/casing but strict on the markers the
// doc-generation + cover-letter pipelines actually scan for.
function validateMasterResume(tex: string): string | null {
    if (!tex.trim()) return 'File is empty.';
    if (!/%\s*<BLOCK:[^>]+>/.test(tex)) {
        return 'No % <BLOCK:Name> markers found — required for per-job tailoring. See hover hint.';
    }
    if (!/%\s*<ENDBLOCK:[^>]+>/.test(tex)) {
        return 'Found % <BLOCK:…> without a matching % <ENDBLOCK:…>.';
    }
    if (!tex.includes('% SKILLS_INJECT_POINT')) {
        return 'Missing % SKILLS_INJECT_POINT marker near your skills line.';
    }
    return null;
}

function validateCoverLetter(tex: string): string | null {
    if (!tex.trim()) return 'File is empty.';
    const missing = (['{{COMPANY}}', '{{POSITION}}', '{{BODY}}'] as const).filter(t => !tex.includes(t));
    if (missing.length) {
        return `Missing placeholder${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`;
    }
    return null;
}

function ResumeStep({ resumeTeX, onResume, coverTeX, onCover }: {
    resumeTeX: string; onResume: (v: string) => void;
    coverTeX: string; onCover: (v: string) => void;
}) {
    const [resumeError, setResumeError] = useState<string | null>(null);
    const [coverError, setCoverError] = useState<string | null>(null);

    const handleFile = (
        setter: (v: string) => void,
        validator: (tex: string) => string | null,
        setError: (err: string | null) => void,
    ) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const tex = reader.result as string;
            const err = validator(tex);
            if (err) {
                setError(err);
                setter('');  // block advance: clear the upstream state
            } else {
                setError(null);
                setter(tex);
            }
        };
        reader.onerror = () => {
            setError('Could not read file.');
            setter('');
        };
        reader.readAsText(file);
    };

    const masterMarkers = (
        <InfoPopover label="Required markers">
            <MarkerList
                title="Two LaTeX markers drive per-job tailoring:"
                items={[
                    {
                        code: '% <BLOCK:Name> ... % <ENDBLOCK:Name>',
                        desc: 'Wrap each removable experience, project, or education entry. Name is arbitrary — e.g. MainJob, SideProject, EduMS. When doc-generation runs, the LLM keeps only the blocks most relevant to the job description and drops the rest so the resume fits a single page. Content outside any block is always kept.',
                    },
                    {
                        code: '% SKILLS_INJECT_POINT',
                        desc: 'Marker where job-specific keywords get inserted — place it at the end of your Skills line. The LLM picks 3–8 keywords from the job description that match your existing experience and appends them here (never invents new skills).',
                    },
                ]}
            />
        </InfoPopover>
    );

    const coverPlaceholders = (
        <InfoPopover label="Template placeholders">
            <MarkerList
                title="Three placeholders get substituted per application:"
                items={[
                    {
                        code: '{{COMPANY}}',
                        desc: 'Replaced with the target company name verbatim (e.g. "Stripe").',
                    },
                    {
                        code: '{{POSITION}}',
                        desc: 'Replaced with the job title from the listing (e.g. "Senior Backend Engineer").',
                    },
                    {
                        code: '{{BODY}}',
                        desc: 'Replaced with a 3–4 sentence paragraph the LLM writes per application, linking your resume experience to the role requirements. Tone is configurable in Settings (professional / enthusiastic / technical).',
                    },
                ]}
            />
        </InfoPopover>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
                Upload your LaTeX resume. Single-column, no tables.
            </p>

            <FileDropField
                label="Master Resume (.tex)"
                accept=".tex"
                hasFile={!!resumeTeX}
                required
                onChange={handleFile(onResume, validateMasterResume, setResumeError)}
                error={resumeError}
                info={masterMarkers}
            />

            <FileDropField
                label="Cover Letter Template (.tex)"
                accept=".tex"
                hasFile={!!coverTeX}
                onChange={handleFile(onCover, validateCoverLetter, setCoverError)}
                error={coverError}
                info={coverPlaceholders}
            />
        </div>
    );
}

/** Info (ⓘ) chip with a subtle text label. Hovering, focusing, or clicking
 * the chip reveals the wrapped panel beneath. Controlled by React state so
 * the "hidden by default" rule works reliably (Tailwind v4 strips plain CSS
 * `display: none` inside `@layer base`). */
function InfoPopover({ label, children }: { label: string; children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    return (
        <span
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            tabIndex={0}
            aria-expanded={open}
            aria-label={`${label} — hover, focus, or click to show details`}
            style={{
                position: 'relative',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 11, color: 'var(--color-text-tertiary)',
                cursor: 'help',
                padding: '2px 8px',
                borderRadius: 999,
                border: '1px solid var(--color-outline-variant)',
                outline: 'none',
                userSelect: 'none',
            }}
        >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v.01" />
                <path d="M11 12h1v5h1" />
            </svg>
            <span>{label}</span>
            {open && (
                <div
                    role="tooltip"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        right: 0,
                        zIndex: 10,
                        minWidth: 260,
                        maxWidth: 420,
                        boxShadow: 'var(--elevation-2)',
                    }}
                >
                    {children}
                </div>
            )}
        </span>
    );
}

/** Visual content shown inside an InfoPopover. The expanded descriptions
 * wrap to multiple lines, so rows are separated with a slightly larger gap
 * than inside each row (code/desc are a tight pair). */
function MarkerList({ title, items }: {
    title: string;
    items: Array<{ code: string; desc: string }>;
}) {
    return (
        <div
            style={{
                padding: '12px 14px',
                borderLeft: '3px solid var(--color-primary)',
                background: 'var(--color-surface-container)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-outline-variant)',
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                lineHeight: 1.45,
                display: 'flex', flexDirection: 'column', gap: 10,
            }}
        >
            <div style={{ color: 'var(--color-text-tertiary)', fontWeight: 500 }}>{title}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map(({ code, desc }) => (
                    <div key={code} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <code
                            style={{
                                fontSize: 11.5,
                                color: 'var(--color-text-primary)',
                                background: 'var(--color-surface-raised)',
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-sm)',
                                alignSelf: 'flex-start',
                                wordBreak: 'break-word',
                            }}
                        >
                            {code}
                        </code>
                        <div style={{ color: 'var(--color-text-secondary)' }}>{desc}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Inline SVG icons keep the bundle lean (no icon-library dep).
function DocIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <path d="M14 3v6h6" />
            <path d="M9 13h6M9 17h6" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 13l4 4L19 7" />
        </svg>
    );
}

function FileDropField({ label, accept, hasFile, onChange, required = false, error = null, info }: {
    label: string; accept: string; hasFile: boolean; required?: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string | null;
    info?: React.ReactNode;
}) {
    const inputId = `file-${label.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')}`;
    const borderColor =
        error ? 'var(--color-error)'
        : hasFile ? 'var(--color-success)'
        : 'var(--color-outline-variant)';
    const bg =
        error ? 'var(--color-error-container)'
        : hasFile ? 'var(--color-success-container)'
        : 'var(--color-surface-raised)';
    const dropPrompt = hasFile && !error
        ? 'Replace file'
        : error
        ? 'Choose a different file'
        : 'Click to upload';

    return (
        <div>
            {/* Field header: label (left) + info chip (right). Both label
                elements associate with the same hidden input via htmlFor so
                the eye has a clear "this chip explains this field" pairing. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <label
                    htmlFor={inputId}
                    style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', cursor: 'pointer' }}
                >
                    {label}
                    {required && (
                        <span aria-hidden="true" style={{ color: 'var(--color-error)', marginLeft: 4 }}>*</span>
                    )}
                </label>
                {info}
            </div>

            {/* Clickable drop zone — label body no longer duplicates the field
                title; it prompts the action instead. */}
            <label
                htmlFor={inputId}
                style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 'var(--radius-lg)',
                    border: `2px dashed ${borderColor}`,
                    background: bg,
                    cursor: 'pointer', transition: 'all 0.2s',
                }}
            >
                <span
                    aria-hidden="true"
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28, flexShrink: 0,
                        color: error ? 'var(--color-error)'
                            : hasFile ? 'var(--color-success)'
                            : 'var(--color-text-tertiary)',
                    }}
                >
                    {hasFile && !error ? <CheckIcon /> : <DocIcon />}
                </span>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', flex: 1 }}>
                    {dropPrompt}
                </span>
                {hasFile && !error && (
                    <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 500 }}>
                        Uploaded
                    </span>
                )}
            </label>

            {/* Hidden input — associated with both labels above via htmlFor. */}
            <input
                id={inputId}
                type="file"
                accept={accept}
                onChange={onChange}
                required={required}
                aria-required={required || undefined}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? `${inputId}-error` : undefined}
                className="wizard-input sr-only"
            />

            {error && (
                <div
                    id={`${inputId}-error`}
                    role="alert"
                    style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: 'var(--color-error)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4" />
                        <path d="M12 16h.01" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}
        </div>
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
                label="LLM Endpoint"
                required
                value={config.llm_endpoint ?? ''}
                onChange={v => onChange({ llm_endpoint: v })}
                placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
                status={validations['llm']}
                onTest={() => testEndpoint('llm', config.llm_endpoint ?? '')}
            />
            <InputField label="LLM API Key" required value={config.llm_api_key ?? ''} onChange={v => onChange({ llm_api_key: v })} type="password" />
            <InputField label="LLM Model" value={config.llm_model ?? 'gemini-1.5-flash'} onChange={v => onChange({ llm_model: v })} />
            <InputField label="GitHub Token" value={config.github_token ?? ''} onChange={v => onChange({ github_token: v })} type="password" />
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
                label="Search Terms"
                required
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
        ['Resume', hasResume ? 'Uploaded' : 'Missing'],
        ['Cover Letter', hasCover ? 'Uploaded' : '— Skipped'],
        ['LLM Endpoint', config.llm_endpoint ?? '—'],
        ['LLM Model', config.llm_model ?? 'gemini-1.5-flash'],
        ['Search Terms', config.search_terms?.join(', ') ?? '—'],
        ['Locations', config.locations?.join(', ') ?? '—'],
        ['GitHub Repos', config.github_repos?.join(', ') ?? '—'],
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

function RequiredMark() {
    return (
        <span aria-hidden="true" style={{ color: 'var(--color-error)', marginLeft: 4 }}>*</span>
    );
}

function InputField({ label, value, onChange, type = 'text', placeholder, required = false }: {
    label: string; value: string; onChange: (v: string) => void;
    type?: string; placeholder?: string; required?: boolean;
}) {
    const inputId = `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
    return (
        <div>
            <label htmlFor={inputId} style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
                {label}{required && <RequiredMark />}
            </label>
            <input
                id={inputId}
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                required={required}
                aria-required={required || undefined}
                className="wizard-input"
                style={{
                    width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface)',
                    color: 'var(--color-text-primary)', outline: 'none',
                    boxSizing: 'border-box',
                }}
            />
        </div>
    );
}

function ValidationIcon({ status }: { status?: 'pending' | 'pass' | 'fail' }) {
    if (!status) return null;
    const common = {
        width: 14, height: 14,
        display: 'inline-flex' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        verticalAlign: 'middle' as const,
        marginLeft: 6,
    };
    if (status === 'pending') {
        return (
            <span role="status" aria-label="Testing…" style={{ ...common, color: 'var(--color-text-tertiary)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" strokeOpacity="0.3" />
                    <path d="M21 12a9 9 0 0 0-9-9" />
                </svg>
            </span>
        );
    }
    if (status === 'pass') {
        return (
            <span role="status" aria-label="Reachable" style={{ ...common, color: 'var(--color-success)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" />
                </svg>
            </span>
        );
    }
    return (
        <span role="status" aria-label="Unreachable" style={{ ...common, color: 'var(--color-error)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
            </svg>
        </span>
    );
}

function ValidatedField({ label, value, onChange, placeholder, status, onTest, required = false }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; status?: 'pending' | 'pass' | 'fail';
    onTest: () => void; required?: boolean;
}) {
    const inputId = `validated-${label.toLowerCase().replace(/\s+/g, '-')}`;

    return (
        <div>
            <label htmlFor={inputId} style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
                {label}{required && <RequiredMark />}<ValidationIcon status={status} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    id={inputId}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onBlur={onTest}
                    placeholder={placeholder}
                    required={required}
                    aria-required={required || undefined}
                    className="wizard-input"
                    style={{
                        flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface)',
                        color: 'var(--color-text-primary)', outline: 'none',
                    }}
                />
                <button
                    onClick={onTest}
                    className="wizard-button"
                    style={{
                        padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: 12,
                        background: 'var(--color-surface-raised)', border: '1px solid var(--color-outline-variant)',
                        color: 'var(--color-text-secondary)', cursor: 'pointer',
                        minHeight: 36,
                    }}
                >
                    Test
                </button>
            </div>
        </div>
    );
}

function TagField({ label, tags, onChange, placeholder, required = false }: {
    label: string; tags: string[]; onChange: (tags: string[]) => void;
    placeholder?: string; required?: boolean;
}) {
    const [input, setInput] = useState('');
    const inputId = `tag-${label.toLowerCase().replace(/\s+/g, '-')}`;

    const addTag = () => {
        const v = input.trim();
        if (v && !tags.includes(v)) {
            onChange([...tags, v]);
        }
        setInput('');
    };

    return (
        <div>
            <label htmlFor={inputId} style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
                {label}{required && <RequiredMark />}
            </label>
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 6,
                padding: '6px 8px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface)',
                minHeight: 36,
            }}>
                {tags.map(tag => (
                    <span key={tag} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 12,
                        background: 'var(--color-primary-container)', color: 'var(--color-primary)',
                    }}>
                        {tag}
                        <button
                            type="button"
                            onClick={() => onChange(tags.filter(t => t !== tag))}
                            className="wizard-button"
                            aria-label={`Remove ${tag}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, padding: 0, lineHeight: 1 }}
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    id={inputId}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    onBlur={addTag}
                    placeholder={tags.length === 0 ? placeholder : ''}
                    aria-required={required || undefined}
                    className="wizard-input"
                    style={{
                        flex: 1, minWidth: 100, border: 'none', outline: 'none',
                        fontSize: 13, background: 'transparent', color: 'var(--color-text-primary)',
                    }}
                />
            </div>
        </div>
    );
}
