'use client';

import { useRef, useState } from 'react';
import { logger } from '@/lib/logger';

type UploadFn = (latexSource: string) => Promise<number>;

export function LatexUploader({
    label,
    description,
    onUpload,
}: {
    label: string;
    description: string;
    onUpload: UploadFn;
}) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'ok' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [uploadedAt, setUploadedAt] = useState<number | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const handleFile = async (file: File | null) => {
        if (!file) return;
        setStatus('uploading');
        setErrorMsg(null);
        try {
            const text = await file.text();
            if (text.length === 0) {
                throw new Error('file is empty');
            }
            if (text.length > 256 * 1024) {
                throw new Error('file larger than 256 KB — check it is a .tex source, not a compiled PDF');
            }
            await onUpload(text);
            setStatus('ok');
            setUploadedAt(Date.now());
            setPreview(text.split('\n').slice(0, 20).join('\n'));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn(`LatexUploader: upload failed — ${msg}`, 'LatexUploader');
            setStatus('error');
            setErrorMsg(msg);
        } finally {
            if (inputRef.current) {
                inputRef.current.value = '';  // allow re-uploading the same file
            }
        }
    };

    const statusColor =
        status === 'ok' ? 'var(--color-success)' :
        status === 'error' ? 'var(--color-error)' :
        status === 'uploading' ? 'var(--color-text-tertiary)' :
        'var(--color-text-tertiary)';

    const statusText =
        status === 'uploading' ? 'Uploading…' :
        status === 'ok' && uploadedAt ? `Uploaded ${new Date(uploadedAt).toLocaleTimeString()}` :
        status === 'error' ? `Error: ${errorMsg}` :
        'No upload this session.';

    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                {label}
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 0, marginBottom: 8 }}>
                {description}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".tex,text/x-tex,text/plain"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    disabled={status === 'uploading'}
                    style={{ fontSize: 12 }}
                />
                <span style={{ fontSize: 11, color: statusColor }}>{statusText}</span>
            </div>
            {preview && (
                <details style={{ marginTop: 6 }}>
                    <summary style={{ fontSize: 11, color: 'var(--color-text-tertiary)', cursor: 'pointer' }}>
                        Preview (first 20 lines)
                    </summary>
                    <pre style={{
                        marginTop: 6,
                        padding: 8,
                        background: 'var(--color-surface-raised)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 6,
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: 'var(--color-text-secondary)',
                        overflow: 'auto',
                        maxHeight: 200,
                    }}>
                        {preview}
                    </pre>
                </details>
            )}
        </div>
    );
}
