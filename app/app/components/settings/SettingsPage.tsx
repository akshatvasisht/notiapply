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
import JsonSchemaForm from './JsonSchemaForm';

export default function SettingsPage({ onBack }: { onBack: () => void }) {
    const [config, setConfig] = useState<UserConfig>({});
    const [modules, setModules] = useState<PipelineModule[]>([]);
    const [showAddModule, setShowAddModule] = useState(false);
    const [expandedModule, setExpandedModule] = useState<number | null>(null);
    const [dirty, setDirty] = useState(false);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    useEffect(() => {
        getUserConfig().then(setConfig).catch(console.error);
        getPipelineModules().then(setModules).catch(console.error);
    }, []);

    const save = async () => {
        await updateUserConfig(config);
        setDirty(false);
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
                <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-text-secondary)' }}>← Back</button>
                <span style={{ fontSize: 15, fontWeight: 500 }}>Settings</span>
                <button onClick={save} disabled={!dirty} style={{
                    padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: 'none',
                    background: dirty ? 'var(--color-google-blue)' : 'var(--color-border)',
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
                        background: 'transparent', color: 'var(--color-google-blue)',
                        border: '1px dashed var(--color-google-blue)', cursor: 'pointer',
                    }}>
                        + Add Custom Module
                    </button>
                </Section>

                {/* LLM */}
                <Section title="LLM">
                    <Field label="Endpoint" value={config.llm_endpoint ?? ''} onChange={v => patch({ llm_endpoint: v })} />
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
                    <Field label="Decodo Proxy" value={config.decodo_proxy ?? ''} onChange={v => patch({ decodo_proxy: v })} placeholder="user:pass@gate.decodo.com:7000" />
                </Section>
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
                    style={{ cursor: 'grab', color: 'var(--color-text-disabled)', fontSize: 14, padding: '0 2px', userSelect: 'none' }}
                >
                    ⠿
                </div>

                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8, flex: 1 }}>
                    <input type="checkbox" checked={mod.enabled} onChange={e => onToggle(e.target.checked)}
                        style={{ accentColor: 'var(--color-google-blue)' }} />
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
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                        color: expanded ? 'var(--color-google-blue)' : 'var(--color-text-tertiary)', padding: '0 4px',
                    }}>
                        {expanded ? '▴ Config' : '▾ Config'}
                    </button>
                )}

                {!mod.is_builtin && (
                    <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--color-google-red)', padding: '0 4px' }}>×</button>
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
                            background: 'var(--color-google-blue)', color: 'var(--color-text-inverse)', border: 'none', cursor: 'pointer',
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
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>{label}</label>
            <input value={value} onChange={e => onChange(e.target.value)} type={type} placeholder={placeholder} style={{
                width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box',
            }} />
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
                    <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 12, background: 'var(--color-blue-tint)', color: 'var(--color-google-blue)' }}>
                        {t}
                        <button onClick={() => onChange(tags.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
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
                        style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, background: 'var(--color-google-blue)', color: 'var(--color-text-inverse)', border: 'none', cursor: 'pointer' }}>Add</button>
                </div>
            </div>
        </div>
    );
}
