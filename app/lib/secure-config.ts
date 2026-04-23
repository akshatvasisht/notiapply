import { getUserConfig, updateUserConfig } from './db';
import { getEncryptionKey, encrypt, decrypt, isEncrypted } from './crypto';
import type { UserConfig } from './types';

const SENSITIVE_FIELDS: (keyof UserConfig)[] = [
    'user_email_password', 'ats_password', 'ats_shared_password',
    'github_token', 'linkedin_cookie', 'n8n_webhook_secret', 'llm_api_key', 'smtp_password',
];

export async function getSecureConfig(): Promise<UserConfig> {
    const config = await getUserConfig();
    const key = getEncryptionKey();
    if (!key) return config; // No encryption key — pass through

    // Decrypt sensitive fields
    for (const field of SENSITIVE_FIELDS) {
        const value = config[field];
        if (typeof value === 'string' && isEncrypted(value)) {
            try {
                (config as Record<string, unknown>)[field] = decrypt(value, key);
            } catch {
                // If decryption fails, leave as-is (might be plaintext from before encryption was enabled)
            }
        }
    }
    return config;
}

export async function updateSecureConfig(config: UserConfig): Promise<void> {
    const key = getEncryptionKey();
    if (!key) return updateUserConfig(config); // No encryption key — pass through

    const secureConfig = { ...config };
    for (const field of SENSITIVE_FIELDS) {
        const value = secureConfig[field];
        if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
            (secureConfig as Record<string, unknown>)[field] = encrypt(value, key);
        }
    }
    return updateUserConfig(secureConfig);
}
