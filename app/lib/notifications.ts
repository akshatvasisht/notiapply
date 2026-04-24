'use client';

/** OS-native notifications via the browser Notification API.
 *
 * Works in Tauri's webview (macOS WebKit, Windows WebView2, Linux WebKitGTK) —
 * and in regular browsers during dev. No Tauri plugin required; the webview
 * proxies the permission prompt + toast to the OS.
 *
 * Fires only when:
 * - Notification API exists (no-op during SSR, server-side, or when disabled
 *   by OS policy)
 * - user_config.notifications_enabled is not explicitly false (default true)
 * - permission is granted (first call triggers the OS prompt)
 */

import { logger } from './logger';
import { getUserConfig } from './db';

export async function sendPipelineNotification(title: string, body: string): Promise<void> {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;

    try {
        const config = await getUserConfig();
        if (config.notifications_enabled === false) return;
    } catch {
        // If config fetch fails (mock mode, early boot), fall back to enabled.
    }

    let permission = Notification.permission;
    if (permission === 'default') {
        try {
            permission = await Notification.requestPermission();
        } catch (err) {
            logger.warn('Notification permission request failed', 'notifications', err);
            return;
        }
    }
    if (permission !== 'granted') return;

    try {
        new Notification(title, { body });
    } catch (err) {
        logger.warn('Failed to dispatch notification', 'notifications', err);
    }
}
