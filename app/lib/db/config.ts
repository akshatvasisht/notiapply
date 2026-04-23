/** User configuration queries */

import { getPool } from './pool';
import type { UserConfig } from '../types';

export async function getUserConfig(): Promise<UserConfig> {
    const { rows } = await getPool().query(`
        SELECT config,
               browser_agent_enabled,
               browser_agent_auto_login,
               browser_agent_fallback,
               browser_agent_max_tokens,
               browser_agent_temperature,
               browser_agent_action_timeout,
               user_email,
               user_email_password,
               user_first_name,
               user_last_name,
               user_phone,
               ats_password,
               email_imap_host,
               email_imap_port,
               email_imap_secure,
               email_verification_timeout
        FROM user_config WHERE id = 1
    `);
    if (!rows[0]) return {};
    const { config, ...directColumns } = rows[0];
    // Direct columns override JSONB config so migrations always win
    const merged: UserConfig = { ...(config ?? {}), ...Object.fromEntries(
        Object.entries(directColumns).filter(([, v]) => v !== null && v !== undefined)
    ) };
    return merged;
}

export async function updateUserConfig(config: UserConfig): Promise<void> {
    // Extract direct-column fields from the payload and write them separately
    const {
        browser_agent_enabled,
        browser_agent_auto_login,
        browser_agent_fallback,
        browser_agent_max_tokens,
        browser_agent_temperature,
        browser_agent_action_timeout,
        user_email,
        user_email_password,
        user_first_name,
        user_last_name,
        user_phone,
        ats_password,
        email_imap_host,
        email_imap_port,
        email_imap_secure,
        email_verification_timeout,
        ...jsonbConfig
    } = config;

    await getPool().query(
        `UPDATE user_config SET
            config = $1,
            browser_agent_enabled = COALESCE($2, browser_agent_enabled),
            browser_agent_auto_login = COALESCE($3, browser_agent_auto_login),
            browser_agent_fallback = COALESCE($4, browser_agent_fallback),
            browser_agent_max_tokens = COALESCE($5, browser_agent_max_tokens),
            browser_agent_temperature = COALESCE($6, browser_agent_temperature),
            browser_agent_action_timeout = COALESCE($7, browser_agent_action_timeout),
            user_email = COALESCE($8, user_email),
            user_email_password = COALESCE($9, user_email_password),
            user_first_name = COALESCE($10, user_first_name),
            user_last_name = COALESCE($11, user_last_name),
            user_phone = COALESCE($12, user_phone),
            ats_password = COALESCE($13, ats_password),
            email_imap_host = COALESCE($14, email_imap_host),
            email_imap_port = COALESCE($15, email_imap_port),
            email_imap_secure = COALESCE($16, email_imap_secure),
            email_verification_timeout = COALESCE($17, email_verification_timeout),
            updated_at = NOW()
        WHERE id = 1`,
        [
            JSON.stringify(jsonbConfig),
            browser_agent_enabled ?? null,
            browser_agent_auto_login ?? null,
            browser_agent_fallback ?? null,
            browser_agent_max_tokens ?? null,
            browser_agent_temperature ?? null,
            browser_agent_action_timeout ?? null,
            user_email ?? null,
            user_email_password ?? null,
            user_first_name ?? null,
            user_last_name ?? null,
            user_phone ?? null,
            ats_password ?? null,
            email_imap_host ?? null,
            email_imap_port ?? null,
            email_imap_secure ?? null,
            email_verification_timeout ?? null,
        ]
    );
}
