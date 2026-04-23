/**
 * One-time migration: encrypt existing plaintext sensitive fields in user_config.
 * Run: ENCRYPTION_KEY=<hex> DATABASE_URL=<url> npx tsx app/scripts/migrate-encrypt-secrets.ts
 */
import { initPool, getUserConfig, updateUserConfig, closePool } from '../lib/db';
import { getEncryptionKey, encrypt, isEncrypted } from '../lib/crypto';

const SENSITIVE_FIELDS = [
    'user_email_password', 'ats_password', 'ats_shared_password',
    'github_token', 'linkedin_cookie', 'n8n_webhook_secret', 'llm_api_key',
] as const;

async function main() {
    const key = getEncryptionKey();
    if (!key) { console.error('ENCRYPTION_KEY not set'); process.exit(1); }

    initPool();
    const config = await getUserConfig();
    let changed = 0;

    for (const field of SENSITIVE_FIELDS) {
        const value = (config as Record<string, unknown>)[field];
        if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
            (config as Record<string, unknown>)[field] = encrypt(value, key);
            changed++;
            console.log(`Encrypted: ${field}`);
        }
    }

    if (changed > 0) {
        await updateUserConfig(config);
        console.log(`Done. Encrypted ${changed} fields.`);
    } else {
        console.log('No plaintext sensitive fields found.');
    }
    await closePool();
}

main().catch(err => { console.error(err); process.exit(1); });
