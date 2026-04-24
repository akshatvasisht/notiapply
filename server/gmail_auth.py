"""Shared Gmail OAuth helper.

Centralizes credential loading for gmail_watcher.py and check_verification_email.py.
Reads from GMAIL_CREDENTIALS_DIR (default: server/ dir, so host-side dev still works;
inside Docker the runner service mounts the host's deploy/docker/gmail/ dir at
/app/credentials).

First-run OAuth bootstrap is done out-of-container via gmail_auth_init.py — this
helper will never open a browser; in a container that fails fast with a clear error.
"""

from __future__ import annotations

import os
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def _credentials_dir() -> Path:
    override = os.environ.get("GMAIL_CREDENTIALS_DIR")
    if override:
        return Path(override)
    # Default: same directory as this file (server/), preserves host-side behavior.
    return Path(__file__).resolve().parent


def credentials_path() -> Path:
    return _credentials_dir() / "gmail_credentials.json"


def token_path() -> Path:
    return _credentials_dir() / "gmail_token.json"


def get_gmail_service():
    """Load persisted token, refresh if expired, return a Gmail API service.

    Raises FileNotFoundError if gmail_token.json is missing — run
    gmail_auth_init.py on the host to produce it.
    """
    token_file = token_path()
    if not token_file.is_file():
        raise FileNotFoundError(
            f"Gmail token not found at {token_file}. "
            "Run server/gmail_auth_init.py on the host to authenticate."
        )

    creds = Credentials.from_authorized_user_file(str(token_file), SCOPES)

    # Refresh if expired — google-auth writes the new token back to disk.
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            token_file.write_text(creds.to_json())
        else:
            raise RuntimeError(
                f"Gmail token at {token_file} is invalid and cannot be refreshed. "
                "Re-run server/gmail_auth_init.py on the host."
            )

    return build("gmail", "v1", credentials=creds)
