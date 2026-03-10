'use client';

import { useEffect, useState } from 'react';
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext, verticalListSortingStrategy, useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    getUserConfig, updateUserConfig, getPipelineModules, toggleModule,
    updateModuleOrder, addCustomModule, deleteModule, updateModuleConfig,
} from '@/lib/db';
import type { UserConfig, PipelineModule } from '@/lib/types';
import { MOCK_CONFIG, MOCK_MODULES } from '@/lib/mock-data';
import JsonSchemaForm from './JsonSchemaForm';
import SourceLegend from './SourceLegend';
import StatusLegend from './StatusLegend';
import ContactStatusLegend from './ContactStatusLegend';

export default function SettingsPage({ onBack }: { onBack: () => void }) {
    const [config, setConfig] = useState<UserConfig>({});
    const [modules, setModules] = useState<PipelineModule[]>([]);
    const [showAddModule, setShowAddModule] = useState(false);
    const [expandedModule, setExpandedModule] = useState<number | null>(null);
    const [dirty, setDirty] = useState(false);
    const [lastSaved, setLastSaved] = useState<number | null>(null);
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
        getUserConfig().then(setConfig).catch(() => {
            console.warn('[DEV] Using mock config');
            setConfig(MOCK_CONFIG);
        });
        getPipelineModules().then(setModules).catch(() => {
            console.warn('[DEV] Using mock modules');
            setModules(MOCK_MODULES);
        });
    }, []);

    const save = async () => {
        await updateUserConfig(config);
        setDirty(false);
        setLastSaved(Date.now());
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
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
                <button onClick={save} disabled={!dirty} style={{
                    padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: 'none',
                    background: dirty ? 'var(--color-primary)' : 'var(--color-border)',
                    color: dirty ? 'var(--color-text-inverse)' : 'var(--color-text-disabled)',
                    cursor: dirty ? 'pointer' : 'not-allowed',
                }}>Save</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 640, margin: '0 auto', width: '100%' }}>

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
                    <Field label="API Key" value={config.llm_api_key ?? ''} onChange={v => patch({ llm_api_key: v })} type="password" />
                    <Field label="Model" value={config.llm_model ?? 'gemini-1.5-flash'} onChange={v => patch({ llm_model: v })} />
                </Section>

                {/* Search & Filter */}
                <Section title="Search & Filter">
                    <TagFieldInline label="Search Terms" tags={config.search_terms ?? []} onChange={t => patch({ search_terms: t })} />
                    <TagFieldInline label="Locations" tags={config.locations ?? []} onChange={t => patch({ locations: t })} />
                    <TagFieldInline label="GitHub Repos" tags={config.github_repos ?? []} onChange={t => patch({ github_repos: t })} />
                    <TagFieldInline label="Exclude Keywords" tags={config.filter?.exclude_keywords ?? []} onChange={t => patch({ filter: { ...config.filter, exclude_keywords: t } })} />
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
                    <Field
                        label="Email SMTP Host (optional)"
                        value={config.smtp_host ?? ''}
                        onChange={v => patch({ smtp_host: v })}
                        placeholder="smtp.gmail.com"
                    />
                    <Field
                        label="Email SMTP Port (optional)"
                        value={config.smtp_port ?? ''}
                        onChange={v => patch({ smtp_port: v })}
                        placeholder="587"
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

// ─── Sortable Module Row ────────────────────────────────────────────────────────

function SortableModuleRow({ module: mod, expanded, onToggle, onExpand, onConfigSave, onDelete }: {
    module: PipelineModule;
    expanded: boolean;
    onToggle: (v: boolean) => void;
    onExpand: () => void;
    onConfigSave: (cfg: Record<string, unknown>) => void;
    onDelete: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: mod.id });
    const [localConfig, setLocalConfig] = useState<Record<string, unknown>>(mod.module_config ?? {});

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : mod.enabled ? 1 : 0.6,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: expanded ? '6px 6px 0 0' : 6,
                border: '1px solid var(--color-border)', background: mod.enabled ? 'var(--color-surface)' : 'var(--color-surface-raised)',
            }}>
                {/* Drag handle */}
                <div
                    {...listeners} {...attributes}
                    style={{ cursor: 'grab', color: 'var(--color-text-disabled)', fontSize: 16, padding: '0 2px', userSelect: 'none' }}
                    aria-label="Drag to reorder"
                >
                    ⋮⋮
                </div>

                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8, flex: 1 }}>
                    <input type="checkbox" checked={mod.enabled} onChange={e => onToggle(e.target.checked)}
                        style={{ accentColor: 'var(--color-primary)' }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{mod.name}</span>
                </label>

                <span style={{ fontSize: 11, color: 'var(--color-text-disabled)', padding: '1px 6px', borderRadius: 4, background: 'var(--color-surface-raised)' }}>
                    {mod.phase}
                </span>

                {mod.dependencies.length > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--color-text-disabled)' }}>needs: {mod.dependencies.join(', ')}</span>
                )}

                {mod.config_schema && (
                    <button onClick={onExpand} style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 11,
                        color: expanded ? 'var(--color-primary)' : 'var(--color-text-tertiary)', padding: '0 4px',
                    }}
                        aria-label={expanded ? 'Collapse config' : 'Expand config'}
                    >
                        {expanded ? 'v Config' : '> Config'}
                    </button>
                )}

                {!mod.is_builtin && (
                    <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--color-error)', padding: '0 4px' }} aria-label="Delete module">×</button>
                )}
            </div>

            {/* Config panel */}
            {expanded && mod.config_schema && (
                <div style={{
                    padding: 16, borderRadius: '0 0 6px 6px',
                    border: '1px solid var(--color-border)', borderTop: 'none',
                    background: 'var(--color-surface-raised)',
                }}>
                    {mod.description && (
                        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 0, marginBottom: 12 }}>
                            {mod.description}
                        </p>
                    )}
                    <JsonSchemaForm
                        schema={mod.config_schema as Parameters<typeof JsonSchemaForm>[0]['schema']}
                        value={localConfig}
                        onChange={setLocalConfig}
                    />
                    <button
                        onClick={() => onConfigSave(localConfig)}
                        style={{
                            marginTop: 12, padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                            background: 'var(--color-primary)', color: 'var(--color-text-inverse)', border: 'none', cursor: 'pointer',
                        }}
                    >
                        Save Config
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Shared ─────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 12, marginTop: 0 }}>{title}</h3>
            {children}
        </div>
    );
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
    return (
        <div style={{ marginBottom: 12 }}>
            <label style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-on-surface-variant)',
                display: 'block',
                marginBottom: 4,
            }}>
                {label}
            </label>
            <input
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

function FieldWithTest({ label, value, onChange, type = 'text', placeholder, onTest }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; onTest: () => Promise<boolean>;
}) {
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

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
            <label style={{
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
                    <span style={{
                        fontSize: 16,
                        color: testResult === 'success' ? 'var(--color-success)' : 'var(--color-error)',
                    }}>
                        {testResult === 'success' ? '✓' : '✗'}
                    </span>
                )}
            </div>
        </div>
    );
}

function TagFieldInline({ label, tags, onChange }: { label: string; tags: string[]; onChange: (t: string[]) => void }) {
    const [input, setInput] = useState('');
    const addTag = () => { const v = input.trim(); if (v && !tags.includes(v)) onChange([...tags, v]); setInput(''); };
    return (
        <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>{label}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', minHeight: 36 }}>
                {tags.map(t => (
                    <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 12, background: 'var(--color-primary-container)', color: 'var(--color-primary)' }}>
                        {t}
                        <button onClick={() => onChange(tags.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16, padding: 0, lineHeight: 1 }} aria-label={`Remove ${t}`}>×</button>
                    </span>
                ))}
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} onBlur={addTag}
                    style={{ flex: 1, minWidth: 80, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: 'var(--color-text-primary)' }} />
            </div>
        </div>
    );
}

function AddModuleModal({ onClose, onAdd }: {
    onClose: () => void;
    onAdd: (mod: { key: string; name: string; description: string; phase: string; n8n_workflow_id: string }) => void;
}) {
    const [name, setName] = useState('');
    const [phase, setPhase] = useState('scraping');
    const [workflowId, setWorkflowId] = useState('');
    const [desc, setDesc] = useState('');
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ width: 400, background: 'var(--color-surface)', borderRadius: 12, padding: 24, border: '1px solid var(--color-border)' }}>
                <h3 style={{ marginTop: 0, fontSize: 15, fontWeight: 600 }}>Add Custom Module</h3>
                <Field label="Module Name" value={name} onChange={setName} />
                <Field label="Description" value={desc} onChange={setDesc} />
                <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>Phase</label>
                    <select value={phase} onChange={e => setPhase(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', outline: 'none' }}>
                        <option value="scraping">Scraping</option>
                        <option value="processing">Processing</option>
                        <option value="output">Output</option>
                    </select>
                </div>
                <Field label="n8n Workflow ID" value={workflowId} onChange={setWorkflowId} />
                <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={() => onAdd({ key: name.toLowerCase().replace(/ /g, '-'), name, description: desc, phase, n8n_workflow_id: workflowId })} disabled={!name || !workflowId}
                        style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, background: 'var(--color-primary)', color: 'var(--color-text-inverse)', border: 'none', cursor: 'pointer' }}>Add</button>
                </div>
            </div>
        </div>
    );
}
