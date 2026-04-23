'use client';

import { useEffect, useState } from 'react';
import { testSmtpConnection, checkDomainHealth, type DomainHealth } from '@/lib/email';
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext, verticalListSortingStrategy,
    arrayMove,
} from '@dnd-kit/sortable';
import {
    getPipelineModules, toggleModule,
    updateModuleOrder, addCustomModule, deleteModule, updateModuleConfig,
} from '@/lib/db';
import { getSecureConfig, updateSecureConfig } from '@/lib/secure-config';
import type { UserConfig, PipelineModule, LLMProvider } from '@/lib/types';
import { logger } from '@/lib/logger';
import { MOCK_CONFIG, MOCK_MODULES } from '@/lib/mock-data';
import SourceLegend from './SourceLegend';
import StatusLegend from './StatusLegend';
import ContactStatusLegend from './ContactStatusLegend';
import { Section } from './SettingsSection';
import { Field, FieldWithTest } from './SettingsField';
import { TagFieldInline } from './TagFieldInline';
import { SortableModuleRow, AddModuleModal } from './PipelineModules';

export default function SettingsPage({ onBack }: { onBack: () => void }) {
    const [config, setConfig] = useState<UserConfig>({});
    const [modules, setModules] = useState<PipelineModule[]>([]);
    const [showAddModule, setShowAddModule] = useState(false);
    const [expandedModule, setExpandedModule] = useState<number | null>(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<number | null>(null);
    const [domainHealth, setDomainHealth] = useState<DomainHealth | null>(null);
    const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; error?: string } | null>(null);
    const [testingSmtp, setTestingSmtp] = useState(false);
    const [checkingDomain, setCheckingDomain] = useState(false);
    const [now, setNow] = useState<number | null>(null);

    useEffect(() => {
        const timeout = setTimeout(() => setNow(Date.now()), 0);
        const interval = setInterval(() => setNow(Date.now()), 60000); // Update "now" every minute
        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, []);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    useEffect(() => {
        getSecureConfig().then(setConfig).catch((err) => {
            logger.warn('DB unavailable, using mock config', 'SettingsPage', err);
            setConfig(MOCK_CONFIG);
        });
        getPipelineModules().then(setModules).catch((err) => {
            logger.warn('DB unavailable, using mock modules', 'SettingsPage', err);
            setModules(MOCK_MODULES);
        });
    }, []);

    const save = async () => {
        if (saving) return;
        setSaving(true);
        try {
            await updateSecureConfig(config);
            setDirty(false);
            setLastSaved(Date.now());
        } finally {
            setSaving(false);
        }
    };

    const patch = (p: Partial<UserConfig>) => { setConfig(prev => ({ ...prev, ...p })); setDirty(true); };

    const handleToggle = async (id: number, enabled: boolean) => {
        await toggleModule(id, enabled);
        setModules(ms => ms.map(m => m.id === id ? { ...m, enabled } : m));
    };

    const handleDelete = async (id: number) => {
        await deleteModule(id);
        setModules(ms => ms.filter(m => m.id !== id));
    };

    const handleConfigSave = async (id: number, cfg: Record<string, unknown>) => {
        await updateModuleConfig(id, cfg);
        setModules(ms => ms.map(m => m.id === id ? { ...m, module_config: cfg } : m));
        setExpandedModule(null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIdx = modules.findIndex(m => m.id === active.id);
        const newIdx = modules.findIndex(m => m.id === over.id);
        const reordered = arrayMove(modules, oldIdx, newIdx);
        setModules(reordered);
        await updateModuleOrder(reordered.map((m, i) => ({ id: m.id, execution_order: (i + 1) * 10 })));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                height: 44, padding: '0 16px',
                background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
            }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-text-secondary)' }}>‹ Back</button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 500 }}>Settings</span>
                    {lastSaved && now && (
                        <span style={{ fontSize: 11, color: 'var(--color-text-disabled)' }}>
                            Last saved {Math.floor((now - lastSaved) / 1000 / 60)} min ago
                        </span>
                    )}
                </div>
                <button onClick={save} disabled={!dirty || saving} style={{
                    padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: 'none',
                    background: dirty && !saving ? 'var(--color-primary)' : 'var(--color-border)',
                    color: dirty && !saving ? 'var(--color-text-inverse)' : 'var(--color-text-disabled)',
                    cursor: dirty && !saving ? 'pointer' : 'not-allowed',
                }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 640, margin: '0 auto', width: '100%', minHeight: 0 }}>

                {/* Pipeline Modules */}
                <Section title="Pipeline">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={modules.map(m => m.id)} strategy={verticalListSortingStrategy}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {modules.map(mod => (
                                    <SortableModuleRow
                                        key={mod.id}
                                        module={mod}
                                        expanded={expandedModule === mod.id}
                                        onToggle={v => handleToggle(mod.id, v)}
                                        onExpand={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}
                                        onConfigSave={cfg => handleConfigSave(mod.id, cfg)}
                                        onDelete={() => handleDelete(mod.id)}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                    <button onClick={() => setShowAddModule(true)} style={{
                        marginTop: 12, padding: '6px 14px', borderRadius: 6, fontSize: 12,
                        background: 'transparent', color: 'var(--color-primary)',
                        border: '1px dashed var(--color-primary)', cursor: 'pointer',
                    }}>
                        + Add Custom Module
                    </button>
                </Section>

                {/* LLM */}
                <Section title="LLM">
                    <div style={{ marginBottom: 12 }}>
                        <label htmlFor="llm-provider-select" style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>Provider</label>
                        <select
                            id="llm-provider-select"
                            value={config.llm_provider ?? 'openai'}
                            onChange={e => patch({ llm_provider: e.target.value as LLMProvider })}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                fontSize: 13,
                                borderRadius: 6,
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-surface)',
                                color: 'var(--color-text-primary)',
                                outline: 'none'
                            }}
                        >
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic</option>
                            <option value="gemini">Google Gemini</option>
                            <option value="local">Local LLM (Ollama, LM Studio)</option>
                        </select>
                    </div>
                    <FieldWithTest
                        label="Endpoint"
                        value={config.llm_endpoint ?? ''}
                        onChange={v => patch({ llm_endpoint: v })}
                        onTest={async () => {
                            if (!config.llm_endpoint) return false;
                            try {
                                const response = await fetch(config.llm_endpoint, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${config.llm_api_key || ''}`,
                                    },
                                    body: JSON.stringify({
                                        model: config.llm_model || 'gemini-1.5-flash',
                                        messages: [{ role: 'user', content: 'test' }],
                                    }),
                                });
                                return response.ok;
                            } catch {
                                return false;
                            }
                        }}
                    />
                    <Field label="API Key" value={config.llm_api_key ?? ''} onChange={v => patch({ llm_api_key: v })} type="password" placeholder="Optional for local LLMs" />
                    <Field label="Model" value={config.llm_model ?? 'gemini-1.5-flash'} onChange={v => patch({ llm_model: v })} placeholder="e.g. gpt-4o-mini, claude-3-5-sonnet-20241022" />
                </Section>

                {/* Browser Agent */}
                <Section title="Browser Agent (AI Automation)">
                    <div style={{ marginBottom: 12 }}>
                        <label htmlFor="browser-agent-enabled" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                            <input
                                id="browser-agent-enabled"
                                type="checkbox"
                                checked={config.browser_agent_enabled ?? false}
                                onChange={e => patch({ browser_agent_enabled: e.target.checked })}
                                style={{ accentColor: 'var(--color-primary)' }}
                            />
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>Enable Browser Agent</span>
                        </label>
                        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4, marginLeft: 24 }}>
                            Use LLM to automate ATS account creation, login, and form filling
                        </p>
                    </div>
                    {config.browser_agent_enabled && (
                        <>
                            <div style={{ marginBottom: 12 }}>
                                <label htmlFor="browser-agent-auto-login" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                                    <input
                                        id="browser-agent-auto-login"
                                        type="checkbox"
                                        checked={config.browser_agent_auto_login ?? false}
                                        onChange={e => patch({ browser_agent_auto_login: e.target.checked })}
                                        style={{ accentColor: 'var(--color-primary)' }}
                                    />
                                    <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>Auto-login & Account Creation</span>
                                </label>
                                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4, marginLeft: 24 }}>
                                    Automatically create accounts and log in when session expires
                                </p>
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <label htmlFor="browser-agent-fallback" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                                    <input
                                        id="browser-agent-fallback"
                                        type="checkbox"
                                        checked={config.browser_agent_fallback ?? false}
                                        onChange={e => patch({ browser_agent_fallback: e.target.checked })}
                                        style={{ accentColor: 'var(--color-primary)' }}
                                    />
                                    <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>Form Filling Fallback</span>
                                </label>
                                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4, marginLeft: 24 }}>
                                    Fill fields that Simplify extension misses
                                </p>
                            </div>
                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
                                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                                    Your Profile
                                </p>
                                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
                                    Used for ATS account creation and email verification.
                                </p>
                                <Field
                                    label="Email"
                                    value={config.user_email ?? ''}
                                    onChange={v => patch({ user_email: v })}
                                    type="email"
                                    placeholder="your.email@example.com"
                                />
                                <Field
                                    label="Email Password (for verification)"
                                    value={config.user_email_password ?? ''}
                                    onChange={v => patch({ user_email_password: v })}
                                    type="password"
                                    placeholder="App-specific password (IMAP access)"
                                />
                                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4, marginBottom: 12 }}>
                                    Gmail users: Run <code style={{ background: 'var(--color-surface-container)', padding: '2px 4px', borderRadius: 3 }}>python server/gmail_watcher.py --auth</code> for faster verification<br/>
                                    Others: Use app-specific password (auto-detects IMAP)
                                </p>
                                <Field
                                    label="First Name"
                                    value={config.user_first_name ?? ''}
                                    onChange={v => patch({ user_first_name: v })}
                                    placeholder="John"
                                />
                                <Field
                                    label="Last Name"
                                    value={config.user_last_name ?? ''}
                                    onChange={v => patch({ user_last_name: v })}
                                    placeholder="Doe"
                                />
                                <Field
                                    label="Phone (optional)"
                                    value={config.user_phone ?? ''}
                                    onChange={v => patch({ user_phone: v })}
                                    type="tel"
                                    placeholder="+1 (555) 123-4567"
                                />
                            </div>

                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
                                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                                    ATS Platform Password
                                </p>
                                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
                                    Password for ATS accounts (Workday, Greenhouse, etc.). <strong>Separate from your email password.</strong>
                                </p>
                                <Field
                                    label="ATS Password"
                                    value={config.ats_password ?? ''}
                                    onChange={v => patch({ ats_password: v })}
                                    type="password"
                                    placeholder="Password for ATS platforms"
                                />
                            </div>

                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
                                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                                    Advanced Settings (Optional)
                                </p>
                                <Field
                                    label="IMAP Host Override"
                                    value={config.email_imap_host ?? ''}
                                    onChange={v => patch({ email_imap_host: v })}
                                    placeholder="Auto-detected for common providers"
                                />
                                <Field
                                    label="Email Verification Timeout (seconds)"
                                    value={config.email_verification_timeout ? String(config.email_verification_timeout / 1000) : '120'}
                                    onChange={v => {
                                        const seconds = parseInt(v) || 120;
                                        const clamped = Math.max(30, Math.min(600, seconds)); // 30s - 10min
                                        patch({ email_verification_timeout: clamped * 1000 });
                                    }}
                                    type="number"
                                    placeholder="120"
                                />
                            </div>
                        </>
                    )}
                </Section>

                {/* Search & Filter */}
                <Section title="Search & Filter">
                    <TagFieldInline label="Search Terms" tags={config.search_terms ?? []} onChange={t => patch({ search_terms: t })} />
                    <TagFieldInline label="Locations" tags={config.locations ?? []} onChange={t => patch({ locations: t })} />
                    <TagFieldInline label="GitHub Repos" tags={config.github_repos ?? []} onChange={t => patch({ github_repos: t })} />
                    <TagFieldInline label="Exclude Keywords" tags={config.filter?.exclude_keywords ?? []} onChange={t => patch({ filter: { ...config.filter, exclude_keywords: t } })} />
                    <Field
                        label="Relevance Score Threshold"
                        value={(config.relevance_threshold ?? 60).toString()}
                        onChange={v => patch({ relevance_threshold: parseInt(v) || 60 })}
                        type="number"
                        placeholder="60"
                    />
                </Section>

                {/* Notifications */}
                <Section title="Notifications & Email">
                    <Field label="ntfy.sh Topic" value={config.ntfy_topic ?? ''} onChange={v => patch({ ntfy_topic: v })} />
                    <Field label="Cloudflare Email Domain (optional)" value={config.cloudflare_email_domain ?? ''} onChange={v => patch({ cloudflare_email_domain: v })} placeholder="yourdomain.com" />
                </Section>

                {/* Credentials */}
                <Section title="Credentials">
                    <Field label="GitHub Token" value={config.github_token ?? ''} onChange={v => patch({ github_token: v })} type="password" />
                </Section>

                {/* CRM & Outreach */}
                <Section title="CRM & Outreach">
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', letterSpacing: '0.8px', textTransform: 'uppercase', paddingBottom: 4, paddingTop: 4 }}>
                        SMTP Sending
                    </div>
                    <Field label="SMTP Host" value={config.smtp_host ?? ''} onChange={v => patch({ smtp_host: v })} placeholder="smtp.gmail.com" />
                    <Field label="SMTP Port" value={config.smtp_port?.toString() ?? ''} onChange={v => patch({ smtp_port: parseInt(v) || undefined })} type="number" placeholder="587" />
                    <Field label="SMTP Username" value={config.smtp_user ?? ''} onChange={v => patch({ smtp_user: v })} placeholder="you@gmail.com" />
                    <Field label="SMTP Password" value={config.smtp_password ?? ''} onChange={v => patch({ smtp_password: v })} type="password" placeholder="App password or SMTP password" />
                    <Field label="From Name" value={config.smtp_from_name ?? ''} onChange={v => patch({ smtp_from_name: v })} placeholder="Your Name" />
                    <Field label="From Email" value={config.smtp_from_email ?? ''} onChange={v => patch({ smtp_from_email: v })} placeholder="you@gmail.com" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2, paddingBottom: 4 }}>
                        <input
                            type="checkbox"
                            id="smtp_secure"
                            checked={config.smtp_secure ?? false}
                            onChange={e => patch({ smtp_secure: e.target.checked })}
                            style={{ cursor: 'pointer' }}
                        />
                        <label htmlFor="smtp_secure" style={{ fontSize: 13, color: 'var(--color-on-surface)', cursor: 'pointer' }}>
                            Use TLS (port 465) — uncheck for STARTTLS (port 587)
                        </label>
                    </div>
                    <Field label="Daily Send Limit" value={config.smtp_daily_limit?.toString() ?? '30'} onChange={v => patch({ smtp_daily_limit: parseInt(v) || 30 })} type="number" placeholder="30" />
                    <Field label="Min Delay Between Sends (minutes)" value={config.smtp_min_delay_minutes?.toString() ?? '10'} onChange={v => patch({ smtp_min_delay_minutes: parseFloat(v) || 10 })} type="number" placeholder="10" />
                    <Field label="Physical Address (CAN-SPAM)" value={config.physical_address ?? ''} onChange={v => patch({ physical_address: v })} placeholder="123 Main St, City, ST 12345" />
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={async () => {
                                setTestingSmtp(true);
                                setSmtpTestResult(null);
                                try {
                                    const result = await testSmtpConnection(config);
                                    setSmtpTestResult(result);
                                } finally {
                                    setTestingSmtp(false);
                                }
                            }}
                            disabled={testingSmtp || !config.smtp_host}
                            style={{
                                padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: config.smtp_host ? 'pointer' : 'not-allowed',
                                background: 'transparent', border: '1px solid var(--color-outline)',
                                color: 'var(--color-on-surface)', opacity: config.smtp_host ? 1 : 0.5,
                            }}
                        >
                            {testingSmtp ? 'Testing…' : 'Test Connection'}
                        </button>
                        {smtpTestResult && (
                            <span style={{ fontSize: 12, color: smtpTestResult.success ? 'var(--color-success)' : 'var(--color-error)' }}>
                                {smtpTestResult.success ? 'Connected' : `Error: ${smtpTestResult.error}`}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={async () => {
                                const domain = config.smtp_from_email?.split('@')[1] || config.smtp_user?.split('@')[1];
                                if (!domain) return;
                                setCheckingDomain(true);
                                setDomainHealth(null);
                                try {
                                    const health = await checkDomainHealth(domain);
                                    setDomainHealth(health);
                                } finally {
                                    setCheckingDomain(false);
                                }
                            }}
                            disabled={checkingDomain || (!config.smtp_from_email && !config.smtp_user)}
                            style={{
                                padding: '6px 14px', borderRadius: 8, fontSize: 12,
                                cursor: (config.smtp_from_email || config.smtp_user) ? 'pointer' : 'not-allowed',
                                background: 'transparent', border: '1px solid var(--color-outline)',
                                color: 'var(--color-on-surface)', opacity: (config.smtp_from_email || config.smtp_user) ? 1 : 0.5,
                            }}
                        >
                            {checkingDomain ? 'Checking…' : 'Check Domain Health'}
                        </button>
                        {domainHealth && (
                            <span style={{ fontSize: 12, display: 'flex', gap: 6 }}>
                                <span style={{ color: domainHealth.spf ? 'var(--color-success)' : 'var(--color-error)' }}>
                                    SPF: {domainHealth.spf ? 'pass' : 'fail'}
                                </span>
                                <span style={{ color: domainHealth.dkim ? 'var(--color-success)' : 'var(--color-error)' }}>
                                    DKIM: {domainHealth.dkim ? 'pass' : 'fail'}
                                </span>
                                <span style={{ color: domainHealth.dmarc ? 'var(--color-success)' : 'var(--color-error)' }}>
                                    DMARC: {domainHealth.dmarc ? 'pass' : 'fail'}
                                </span>
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', letterSpacing: '0.8px', textTransform: 'uppercase', paddingBottom: 4, paddingTop: 8 }}>
                        Outreach Settings
                    </div>
                    <Field
                        label="Default Message Tone"
                        value={config.crm_message_tone ?? 'professional'}
                        onChange={v => patch({ crm_message_tone: v })}
                        placeholder="professional, casual, enthusiastic"
                    />
                    <Field
                        label="LinkedIn Cookie (for enrichment)"
                        value={config.linkedin_cookie ?? ''}
                        onChange={v => patch({ linkedin_cookie: v })}
                        type="password"
                        placeholder="li_at cookie value"
                    />
                </Section>

                {/* Data Management */}
                <Section title="Data Management">
                    <Field
                        label="Auto-archive jobs after (months)"
                        value={config.archive_after_months?.toString() ?? '3'}
                        onChange={v => patch({ archive_after_months: parseInt(v) || 3 })}
                        type="number"
                        placeholder="3"
                    />
                    <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginTop: -8 }}>
                        Jobs older than this will be moved to archive after state transition to "submitted" or "rejected"
                    </div>
                </Section>

                {/* Legends */}
                <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <SourceLegend />
                    <StatusLegend />
                    <ContactStatusLegend />
                </div>
            </div>

            {showAddModule && (
                <AddModuleModal
                    onClose={() => setShowAddModule(false)}
                    onAdd={async mod => {
                        await addCustomModule(mod);
                        setModules(await getPipelineModules());
                        setShowAddModule(false);
                    }}
                />
            )}
        </div>
    );
}

