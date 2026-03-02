/** Notiapply — Tauri invoke and sidecar wrappers */

import type { SidecarEvent } from './types';

// Dynamic import guards — Tauri APIs only available in desktop context
let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let tauriCommand: ((typeof import('@tauri-apps/plugin-shell'))['Command']) | null = null;

async function ensureTauri() {
    if (typeof window === 'undefined') return false;
    if (tauriInvoke) return true;
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { Command } = await import('@tauri-apps/plugin-shell');
        tauriInvoke = invoke;
        tauriCommand = Command;
        return true;
    } catch {
        return false;
    }
}

export async function createFillSession(sessionId: string): Promise<void> {
    if (!(await ensureTauri())) return;
    await tauriInvoke!('create_fill_session', { sessionId });
}

export async function getEnv(key: string): Promise<string> {
    if (!(await ensureTauri())) return '';
    return (await tauriInvoke!('get_env', { key })) as string;
}

export async function startFillSession(
    onEvent: (event: SidecarEvent) => void,
    onClose: (code: number) => void,
): Promise<string> {
    if (!(await ensureTauri())) throw new Error('Tauri not available');

    const sessionId = crypto.randomUUID();
    await createFillSession(sessionId);

    const chromiumPath = await getEnv('CHROMIUM_EXECUTABLE_PATH');
    const simplifyPath = await getEnv('SIMPLIFY_EXTENSION_PATH');

    const sidecar = tauriCommand!.sidecar('binaries/node', [
        'sidecar/fill.js',
        '--session-id', sessionId,
        '--chromium-path', chromiumPath,
        '--simplify-path', simplifyPath,
    ]);

    sidecar.stdout.on('data', (line: string) => {
        try {
            const event = JSON.parse(line.trim()) as SidecarEvent;
            onEvent(event);
        } catch {
            /* partial line — ignore */
        }
    });

    sidecar.stderr.on('data', (line: string) => {
        console.error('[sidecar]', line);
    });

    sidecar.on('close', (data: { code: number | null }) => {
        onClose(data.code ?? 0);
    });

    await sidecar.spawn();
    return sessionId;
}

export async function triggerPipelineRun(webhookUrl: string, webhookSecret: string): Promise<boolean> {
    // Preflight health check
    try {
        const healthUrl = webhookUrl.replace('/webhook/', '/healthz');
        await fetch(healthUrl, { signal: AbortSignal.timeout(4000) });
    } catch {
        return false;
    }

    await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'X-Webhook-Secret': webhookSecret },
    });
    return true;
}
