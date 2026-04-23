import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Get encryption key from ENCRYPTION_KEY env var.
 * Returns null if not set (graceful degradation — no encryption).
 */
export function getEncryptionKey(): Buffer | null {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex) return null;
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    return key;
}

/**
 * Encrypt a plaintext string. Returns format: iv:tag:ciphertext (all base64).
 */
export function encrypt(plaintext: string, key: Buffer): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt a ciphertext string in format: iv:tag:ciphertext (all base64).
 */
export function decrypt(ciphertext: string, key: Buffer): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted format');
    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final('utf8');
}

/**
 * Check if a value looks like it's already encrypted (iv:tag:ciphertext format).
 */
export function isEncrypted(value: string): boolean {
    const parts = value.split(':');
    return parts.length === 3 && parts.every(p => {
        try { Buffer.from(p, 'base64'); return true; } catch { return false; }
    });
}
