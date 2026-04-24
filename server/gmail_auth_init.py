"""Host-side Gmail OAuth bootstrap.

Run this ONCE on the user's machine (outside Docker compose) to generate
gmail_token.json. The token then gets mounted into the runner container at
/app/credentials/gmail_token.json via docker-compose volume.

Usage:
    python server/gmail_auth_init.py              # default output dir: deploy/docker/gmail/
    python server/gmail_auth_init.py --dir ./foo  # override output dir

Prerequisites:
    1. Enable Gmail API in Google Cloud Console
    2. Create OAuth 2.0 Client ID credentials (Desktop app)
    3. Download credentials.json → place at <output-dir>/gmail_credentials.json
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

from gmail_auth import SCOPES


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DIR = REPO_ROOT / "deploy" / "docker" / "gmail"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Gmail OAuth token for Docker runner.")
    parser.add_argument(
        "--dir",
        type=Path,
        default=DEFAULT_DIR,
        help=f"Output directory (default: {DEFAULT_DIR})",
    )
    args = parser.parse_args()

    out_dir: Path = args.dir
    out_dir.mkdir(parents=True, exist_ok=True)

    credentials_file = out_dir / "gmail_credentials.json"
    token_file = out_dir / "gmail_token.json"

    if not credentials_file.is_file():
        print(
            f"error: {credentials_file} missing.\n"
            "Download OAuth client credentials from Google Cloud Console "
            "(APIs & Services → Credentials → OAuth 2.0 Client IDs, Desktop app) "
            f"and save as {credentials_file.name} in {out_dir}.",
            file=sys.stderr,
        )
        return 2

    print(f"Starting OAuth flow (browser will open)…")
    flow = InstalledAppFlow.from_client_secrets_file(str(credentials_file), SCOPES)
    creds = flow.run_local_server(port=0)
    token_file.write_text(creds.to_json())

    # Lock down permissions so a leak is less catastrophic.
    try:
        token_file.chmod(0o600)
    except OSError:
        pass  # Windows / non-POSIX — best-effort.

    print(f"\n✓ Token saved to {token_file}")
    print("Next step: docker compose up -d && docker compose restart runner")
    return 0


if __name__ == "__main__":
    sys.exit(main())
