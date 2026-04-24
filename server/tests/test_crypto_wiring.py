"""Tests for server/scraper/crypto_helper.py — specifically the fields-in-config
wiring added in B-02 to decrypt secrets that the frontend encrypts at write
time (see app/lib/secure-config.ts).

Covers:
  - `decrypt_if_needed` graceful fallbacks (no key / plaintext / malformed)
  - `decrypt_config` iterates the SENSITIVE_CFG_FIELDS list
  - round-trip encrypt-then-decrypt with a real AESGCM key
  - non-sensitive fields in cfg are left untouched
"""
from __future__ import annotations

import base64
import os
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scraper.crypto_helper import (  # noqa: E402
    SENSITIVE_CFG_FIELDS,
    decrypt_config,
    decrypt_if_needed,
    get_encryption_key,
    is_encrypted,
)


# ─── decrypt_if_needed — graceful paths ──────────────────────────────────────


class TestDecryptIfNeeded:
    def test_none_value_passes_through(self):
        assert decrypt_if_needed(None, b"x" * 32) is None

    def test_none_key_passes_through(self):
        assert decrypt_if_needed("plaintext-sk-abc", None) == "plaintext-sk-abc"

    def test_plaintext_not_in_envelope_format_passes_through(self):
        # Plain API key like "sk-abc123" — no colons, can't possibly be the
        # iv:tag:ciphertext envelope. Must return unchanged.
        assert decrypt_if_needed("sk-abc123", b"x" * 32) == "sk-abc123"

    def test_malformed_envelope_passes_through(self):
        # Three colon-separated parts but one isn't valid base64.
        assert decrypt_if_needed("not:valid:envelope!!!", b"x" * 32) == "not:valid:envelope!!!"

    def test_decrypt_failure_returns_original_value(self):
        """A value that looks like a valid envelope (three base64 parts) but
        was NOT produced by the current key — decrypt should fail internally,
        and we fall back to returning the original value rather than raising."""
        envelope = (
            base64.b64encode(b"x" * 12).decode() + ":"
            + base64.b64encode(b"y" * 16).decode() + ":"
            + base64.b64encode(b"z" * 32).decode()
        )
        key = b"x" * 32
        assert decrypt_if_needed(envelope, key) == envelope


# ─── is_encrypted heuristic ──────────────────────────────────────────────────


class TestIsEncrypted:
    def test_plaintext_returns_false(self):
        assert is_encrypted("sk-abc") is False

    def test_two_parts_returns_false(self):
        assert is_encrypted("foo:bar") is False

    def test_three_base64_parts_returns_true(self):
        envelope = (
            base64.b64encode(b"iv").decode() + ":"
            + base64.b64encode(b"tag").decode() + ":"
            + base64.b64encode(b"data").decode()
        )
        assert is_encrypted(envelope) is True

    def test_three_parts_but_not_base64_returns_false(self):
        assert is_encrypted("abc:def:!!") is False


# ─── get_encryption_key ──────────────────────────────────────────────────────


class TestGetEncryptionKey:
    def test_no_env_var_returns_none(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("ENCRYPTION_KEY", None)
            assert get_encryption_key() is None

    def test_valid_key_decoded(self):
        with patch.dict(os.environ, {"ENCRYPTION_KEY": "00" * 32}):
            key = get_encryption_key()
        assert key == b"\x00" * 32

    def test_wrong_length_raises(self):
        with patch.dict(os.environ, {"ENCRYPTION_KEY": "00" * 16}):  # only 16 bytes
            with pytest.raises(ValueError):
                get_encryption_key()


# ─── decrypt_config — the field-iterating wrapper ────────────────────────────


class TestDecryptConfig:
    def test_empty_cfg_returns_empty(self):
        assert decrypt_config({}) == {}

    def test_no_key_leaves_values_unchanged(self):
        cfg = {"llm_api_key": "sk-abc", "github_token": "ghp_xyz", "search_terms": ["python"]}
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("ENCRYPTION_KEY", None)
            out = decrypt_config(cfg)
        assert out["llm_api_key"] == "sk-abc"
        assert out["github_token"] == "ghp_xyz"
        assert out["search_terms"] == ["python"]  # not touched

    def test_non_sensitive_fields_never_touched(self):
        """decrypt_config should not call decrypt_if_needed for non-sensitive
        fields even if they happen to look like envelopes."""
        envelope_lookalike = (
            base64.b64encode(b"iv").decode() + ":"
            + base64.b64encode(b"tag").decode() + ":"
            + base64.b64encode(b"data").decode()
        )
        cfg = {"crm_message_tone": envelope_lookalike, "search_terms": [envelope_lookalike]}
        out = decrypt_config(cfg)
        # crm_message_tone / search_terms are NOT in SENSITIVE_CFG_FIELDS, so the
        # envelope-shaped value stays verbatim.
        assert out["crm_message_tone"] == envelope_lookalike
        assert out["search_terms"] == [envelope_lookalike]

    def test_sensitive_field_list_matches_frontend_expectations(self):
        """Guard that the server-side sensitive list stays in sync with
        app/lib/secure-config.ts. If the frontend adds a new field to its
        encryption list without updating us here, this test catches the drift."""
        expected = {
            "llm_api_key",
            "user_email_password",
            "ats_password",
            "ats_shared_password",
            "github_token",
            "linkedin_cookie",
            "n8n_webhook_secret",
            "smtp_password",
        }
        assert set(SENSITIVE_CFG_FIELDS) == expected


# ─── Round-trip: encrypt with a key, decrypt back ────────────────────────────


class TestRoundTrip:
    def test_encrypt_then_decrypt_with_same_key(self):
        """Use cryptography directly to produce the exact envelope the
        frontend emits (iv:tag:ciphertext, all base64), then feed it through
        decrypt_config and confirm we recover the plaintext."""
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        key = b"\x42" * 32
        plaintext = b"sk-super-secret"
        iv = b"\x11" * 12
        aesgcm = AESGCM(key)
        ct_with_tag = aesgcm.encrypt(iv, plaintext, None)
        # AESGCM appends the 16-byte tag at the end of the ciphertext.
        ciphertext = ct_with_tag[:-16]
        tag = ct_with_tag[-16:]

        envelope = (
            base64.b64encode(iv).decode() + ":"
            + base64.b64encode(tag).decode() + ":"
            + base64.b64encode(ciphertext).decode()
        )

        cfg = {"llm_api_key": envelope, "something_else": "plaintext"}
        with patch.dict(os.environ, {"ENCRYPTION_KEY": key.hex()}):
            out = decrypt_config(cfg)

        assert out["llm_api_key"] == "sk-super-secret"
        assert out["something_else"] == "plaintext"
