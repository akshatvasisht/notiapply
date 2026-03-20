'use client';

/**
 * JsonSchemaForm — dynamic form renderer from a JSON Schema object.
 * Handles: string, number, boolean, array (of strings), enum.
 * Used to render pipeline module config_schema fields.
 */

interface JsonSchemaFormProps {
    schema: JsonSchema;
    value: Record<string, unknown>;
    onChange: (v: Record<string, unknown>) => void;
}

interface JsonSchema {
    type?: string;
    title?: string;
    description?: string;
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
}

interface JsonSchemaProperty {
    type?: string;
    title?: string;
    description?: string;
    default?: unknown;
    enum?: string[];
    items?: { type?: string; enum?: string[] };
    minimum?: number;
    maximum?: number;
}

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6,
    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
    color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box',
};

export default function JsonSchemaForm({ schema, value, onChange }: JsonSchemaFormProps) {
    if (!schema?.properties) return null;

    const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Object.entries(schema.properties).map(([key, prop]) => (
                <FieldRenderer
                    key={key}
                    fieldKey={key}
                    prop={prop}
                    value={value[key]}
                    onChange={v => set(key, v)}
                    required={schema.required?.includes(key) ?? false}
                />
            ))}
        </div>
    );
}

function FieldRenderer({ fieldKey, prop, value, onChange, required }: {
    fieldKey: string;
    prop: JsonSchemaProperty;
    value: unknown;
    onChange: (v: unknown) => void;
    required: boolean;
}) {
    const label = prop.title ?? fieldKey;
    const current = value ?? prop.default;
    const inputId = `field-${fieldKey}`;

    // Enum → <select>
    if (prop.enum) {
        return (
            <Field label={label} description={prop.description} required={required} htmlFor={inputId}>
                <select id={inputId} value={String(current ?? prop.enum[0])} onChange={e => onChange(e.target.value)} style={{ ...inputStyle }}>
                    {prop.enum.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </Field>
        );
    }

    // Array of strings (or array of enum)
    if (prop.type === 'array') {
        const arr: string[] = Array.isArray(current) ? (current as string[]) : [];
        const itemEnum = prop.items?.enum;

        if (itemEnum) {
            // Multi-checkbox for small enum arrays
            return (
                <Field label={label} description={prop.description} required={required} htmlFor="">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {itemEnum.map(opt => {
                            const checkboxId = `${fieldKey}-${opt}`;
                            return (
                                <label key={opt} htmlFor={checkboxId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                                    <input
                                        id={checkboxId}
                                        type="checkbox"
                                        checked={arr.includes(opt)}
                                        onChange={e => {
                                            const next = e.target.checked ? [...arr, opt] : arr.filter(x => x !== opt);
                                            onChange(next);
                                        }}
                                        style={{ accentColor: 'var(--color-primary)' }}
                                    />
                                    {opt}
                                </label>
                            );
                        })}
                    </div>
                </Field>
            );
        }

        // Free-form string array with tag input
        return (
            <Field label={label} description={prop.description} required={required} htmlFor={inputId}>
                <TagArrayInput values={arr} onChange={onChange} inputId={inputId} />
            </Field>
        );
    }

    // Boolean → checkbox
    if (prop.type === 'boolean') {
        const checkboxId = `${fieldKey}-checkbox`;
        return (
            <label htmlFor={checkboxId} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                    id={checkboxId}
                    type="checkbox"
                    checked={Boolean(current)}
                    onChange={e => onChange(e.target.checked)}
                    style={{ accentColor: 'var(--color-primary)', width: 14, height: 14 }}
                />
                <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
                    {label}
                    {required && <span style={{ color: 'var(--color-error)', marginLeft: 2 }}>*</span>}
                </span>
                {prop.description && (
                    <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{prop.description}</span>
                )}
            </label>
        );
    }

    // Number → range if min/max, else number input
    if (prop.type === 'number' || prop.type === 'integer') {
        const num = current != null ? Number(current) : (prop.default != null ? Number(prop.default) : '');
        if (prop.minimum != null && prop.maximum != null) {
            return (
                <Field label={`${label}: ${num}`} description={prop.description} required={required} htmlFor={inputId}>
                    <input
                        id={inputId}
                        type="range" min={prop.minimum} max={prop.maximum}
                        value={Number(num)} onChange={e => onChange(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-disabled)' }}>
                        <span>{prop.minimum}</span><span>{prop.maximum}</span>
                    </div>
                </Field>
            );
        }
        return (
            <Field label={label} description={prop.description} required={required} htmlFor={inputId}>
                <input id={inputId} type="number" value={num} onChange={e => onChange(Number(e.target.value))} style={inputStyle} />
            </Field>
        );
    }

    // Default → string text input
    return (
        <Field label={label} description={prop.description} required={required} htmlFor={inputId}>
            <input id={inputId} type="text" value={String(current ?? '')} onChange={e => onChange(e.target.value)} style={inputStyle} />
        </Field>
    );
}

function Field({ label, description, required, htmlFor, children }: {
    label: string; description?: string; required: boolean; htmlFor?: string; children: React.ReactNode;
}) {
    return (
        <div>
            <label htmlFor={htmlFor} style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 4 }}>
                {label}
                {required && <span style={{ color: 'var(--color-error)', marginLeft: 2 }}>*</span>}
                {description && <span style={{ fontWeight: 400, marginLeft: 6, color: 'var(--color-text-disabled)' }}>{description}</span>}
            </label>
            {children}
        </div>
    );
}

function TagArrayInput({ values, onChange, inputId }: { values: string[]; onChange: (v: unknown) => void; inputId?: string }) {
    return (
        <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 4,
            padding: '6px 8px', borderRadius: 6,
            border: '1px solid var(--color-border)', background: 'var(--color-surface)', minHeight: 36,
        }}>
            {values.map(v => (
                <span key={v} style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 12,
                    background: 'var(--color-primary-container)', color: 'var(--color-primary)',
                }}>
                    {v}
                    <button onClick={() => onChange(values.filter(x => x !== v))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, padding: 0, lineHeight: 1 }}>
                        X
                    </button>
                </span>
            ))}
            <input
                id={inputId}
                onKeyDown={e => {
                    const input = e.currentTarget;
                    if (e.key === 'Enter' && input.value.trim()) {
                        const v = input.value.trim();
                        if (!values.includes(v)) onChange([...values, v]);
                        input.value = '';
                        e.preventDefault();
                    }
                }}
                placeholder={values.length === 0 ? 'Type and press Enter...' : ''}
                style={{ flex: 1, minWidth: 80, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: 'var(--color-text-primary)' }}
            />
        </div>
    );
}
