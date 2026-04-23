"""AES-256-GCM decryption compatible with app/lib/crypto.ts format."""
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def get_encryption_key() -> bytes | None:
    key_hex = os.environ.get("ENCRYPTION_KEY")
    if not key_hex:
        return None
    key = bytes.fromhex(key_hex)
    if len(key) != 32:
        raise ValueError("ENCRYPTION_KEY must be 64 hex characters (32 bytes)")
    return key


def decrypt(ciphertext: str, key: bytes) -> str:
    parts = ciphertext.split(":")
    if len(parts) != 3:
        raise ValueError("Invalid encrypted format")
    iv = base64.b64decode(parts[0])
    tag = base64.b64decode(parts[1])
    data = base64.b64decode(parts[2])
    aesgcm = AESGCM(key)
    # AESGCM expects ciphertext + tag concatenated
    plaintext = aesgcm.decrypt(iv, data + tag, None)
    return plaintext.decode("utf-8")


def is_encrypted(value: str) -> bool:
    parts = value.split(":")
    if len(parts) != 3:
        return False
    try:
        for p in parts:
            base64.b64decode(p)
        return True
    except Exception:
        return False


def decrypt_if_needed(value: str | None, key: bytes | None) -> str | None:
    if value is None or key is None:
        return value
    if is_encrypted(value):
        try:
            return decrypt(value, key)
        except Exception:
            return value  # Might be plaintext
    return value
