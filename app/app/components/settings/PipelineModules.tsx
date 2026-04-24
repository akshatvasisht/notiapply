'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PipelineModule } from '@/lib/types';
import JsonSchemaForm from './JsonSchemaForm';
import { Field } from './SettingsField';

export function SortableModuleRow({ module: mod, expanded, onToggle, onExpand, onConfigSave, onDelete }: {
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

                <label htmlFor={`module-${mod.id}-enabled`} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8, flex: 1 }}>
                    <input id={`module-${mod.id}-enabled`} type="checkbox" checked={mod.enabled} onChange={e => onToggle(e.target.checked)}
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

export function AddModuleModal({ onClose, onAdd }: {
    onClose: () => void;
    onAdd: (mod: { key: string; name: string; description: string; phase: string; n8n_workflow_id: string }) => void;
}) {
    const [name, setName] = useState('');
    const [phase, setPhase] = useState('scraping');
    const [workflowId, setWorkflowId] = useState('');
    const [desc, setDesc] = useState('');
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--color-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ width: 'min(400px, 90vw)', background: 'var(--color-surface)', borderRadius: 12, padding: 24, border: '1px solid var(--color-border)' }}>
                <h3 style={{ marginTop: 0, fontSize: 15, fontWeight: 600 }}>Add Custom Module</h3>
                <Field label="Module Name" value={name} onChange={setName} />
                <Field label="Description" value={desc} onChange={setDesc} />
                <div style={{ marginBottom: 12 }}>
                    <label htmlFor="phase-select" style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>Phase</label>
                    <select id="phase-select" value={phase} onChange={e => setPhase(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', outline: 'none' }}>
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
