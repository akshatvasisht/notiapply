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


# Fields written encrypted by app/lib/secure-config.ts. Kept in sync with the
# `SENSITIVE_FIELDS` list there so decryption on read matches encryption on
# write. Used by every server-side consumer of user_config.
SENSITIVE_CFG_FIELDS = (
    "llm_api_key",
    "user_email_password",
    "ats_password",
    "ats_shared_password",
    "github_token",
    "linkedin_cookie",
    "n8n_webhook_secret",
    "smtp_password",
)


def decrypt_config(cfg: dict) -> dict:
    """Decrypt sensitive fields in `cfg` in-place and return it.

    Graceful: if `ENCRYPTION_KEY` isn't set, or a value isn't encrypted,
    `decrypt_if_needed` returns the original value — safe on plaintext rows.
    """
    key = get_encryption_key()
    for field in SENSITIVE_CFG_FIELDS:
        if field in cfg:
            cfg[field] = decrypt_if_needed(cfg.get(field), key)
    return cfg
