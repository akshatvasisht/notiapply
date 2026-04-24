"""Gmail reply-watcher — runner-dispatched module.

Polls Gmail for replies from contacts in state='contacted' with got_response IS NULL.
On a match, flips the contact to state='replied', got_response=true, and appends a
message-id-keyed entry to interaction_log.

Wired into server/runner/app.py SCRIPT_MAP as "gmail-watch". The runner calls:
    python gmail_watcher.py '<json_payload>'

Expected payload keys (all optional, all have defaults):
    db_url          Postgres DSN (auto-injected by runner from DATABASE_URL env)
    lookback_days   How many days back to scan Gmail (default: 14)
    batch_size      Max contacts to query per run (default: 100)

Emits a single trailing JSON line to stdout:
    {"processed": N, "replied": M, "skipped_duplicates": K, "errors": [...]}

Stderr is used for human-readable progress.
"""

from __future__ import annotations

import contextlib
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import psycopg2

from gmail_auth import get_gmail_service


# ──────────────────────────────────────────────────────────────────────────────
# DB helpers
# ──────────────────────────────────────────────────────────────────────────────


def _fetch_awaiting_contacts(db_url: str, batch_size: int) -> List[Dict[str, Any]]:
    # psycopg2's connect-as-ctx-manager commits/rolls back on exit but does NOT
    # close the connection — wrap with contextlib.closing() so both the tx and
    # the connection are cleaned up in one idiomatic block.
    with contextlib.closing(psycopg2.connect(db_url)) as conn, conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, email, company_name, last_contacted_at, interaction_log
              FROM contacts
             WHERE state = 'contacted'
               AND got_response IS NULL
               AND email IS NOT NULL
               AND email <> ''
             ORDER BY last_contacted_at DESC NULLS LAST
             LIMIT %s
            """,
            (batch_size,),
        )
        rows = cur.fetchall()

    return [
        {
            "id": row[0],
            "name": row[1],
            "email": row[2].lower(),
            "company_name": row[3],
            "last_contacted_at": row[4],
            "interaction_log": row[5] or [],
        }
        for row in rows
    ]


def _already_logged(interaction_log: List[Dict[str, Any]], message_id: str) -> bool:
    """True if any existing entry references this Gmail message_id."""
    for entry in interaction_log:
        if isinstance(entry, dict) and entry.get("message_id") == message_id:
            return True
    return False


def _record_reply(db_url: str, contact_id: int, reply: Dict[str, Any]) -> None:
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": "Email reply received",
        "notes": f"Subject: {reply['subject']} — {reply['snippet'][:140]}",
        "message_id": reply["message_id"],
    }
    with contextlib.closing(psycopg2.connect(db_url)) as conn, conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE contacts
               SET got_response = true,
                   state = 'replied',
                   interaction_log = COALESCE(interaction_log, '[]'::jsonb) || %s::jsonb
             WHERE id = %s
            """,
            (json.dumps(entry), contact_id),
        )


# ──────────────────────────────────────────────────────────────────────────────
# Gmail helpers
# ──────────────────────────────────────────────────────────────────────────────


def _extract_email(from_header: str) -> str:
    if "<" in from_header and ">" in from_header:
        return from_header.split("<", 1)[1].split(">", 1)[0].strip()
    return from_header.strip()


def _find_replies(service, contacts: List[Dict[str, Any]], lookback_days: int) -> List[Dict[str, Any]]:
    """Return list of {contact_id, contact_name, email, subject, snippet, message_id}."""
    if not contacts:
        return []

    after = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).strftime("%Y/%m/%d")
    email_filter = " OR ".join(c["email"] for c in contacts)
    query = f"from:({email_filter}) after:{after}"

    results = service.users().messages().list(userId="me", q=query, maxResults=500).execute()
    messages = results.get("messages", [])

    by_email = {c["email"]: c for c in contacts}
    replies: List[Dict[str, Any]] = []

    for msg in messages:
        msg_id = msg["id"]
        detail = (
            service.users()
            .messages()
            .get(userId="me", id=msg_id, format="metadata", metadataHeaders=["From", "Subject", "Date"])
            .execute()
        )
        headers = {h["name"]: h["value"] for h in detail.get("payload", {}).get("headers", [])}
        from_email = _extract_email(headers.get("From", "")).lower()
        contact = by_email.get(from_email)
        if not contact:
            continue

        replies.append(
            {
                "contact_id": contact["id"],
                "contact_name": contact["name"],
                "contact_interaction_log": contact["interaction_log"],
                "email": from_email,
                "subject": headers.get("Subject", "(no subject)"),
                "snippet": detail.get("snippet", ""),
                "message_id": msg_id,
            }
        )

    return replies


# ──────────────────────────────────────────────────────────────────────────────
# Runner entry point
# ──────────────────────────────────────────────────────────────────────────────


def run(payload: Dict[str, Any]) -> Dict[str, Any]:
    db_url = payload.get("db_url") or os.environ.get("DATABASE_URL")
    if not db_url:
        return {"processed": 0, "replied": 0, "skipped_duplicates": 0, "errors": ["db_url missing"]}

    lookback_days = int(payload.get("lookback_days", 14))
    batch_size = int(payload.get("batch_size", 100))
    errors: List[str] = []

    try:
        service = get_gmail_service()
    except FileNotFoundError as exc:
        return {"processed": 0, "replied": 0, "skipped_duplicates": 0, "errors": [str(exc)]}
    except Exception as exc:  # noqa: BLE001
        return {"processed": 0, "replied": 0, "skipped_duplicates": 0, "errors": [f"gmail auth failed: {exc}"]}

    contacts = _fetch_awaiting_contacts(db_url, batch_size)
    print(f"gmail-watch: {len(contacts)} contacts awaiting reply", file=sys.stderr)
    if not contacts:
        return {"processed": 0, "replied": 0, "skipped_duplicates": 0, "errors": errors}

    try:
        replies = _find_replies(service, contacts, lookback_days)
    except Exception as exc:  # noqa: BLE001
        return {
            "processed": len(contacts),
            "replied": 0,
            "skipped_duplicates": 0,
            "errors": [f"gmail query failed: {exc}"],
        }

    replied = 0
    duplicates = 0
    for reply in replies:
        if _already_logged(reply["contact_interaction_log"], reply["message_id"]):
            duplicates += 1
            continue
        try:
            _record_reply(db_url, reply["contact_id"], reply)
            replied += 1
            print(
                f"gmail-watch: contact #{reply['contact_id']} ({reply['contact_name']}) → replied",
                file=sys.stderr,
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(f"update contact {reply['contact_id']}: {exc}")

    return {
        "processed": len(contacts),
        "replied": replied,
        "skipped_duplicates": duplicates,
        "errors": errors,
    }


if __name__ == "__main__":
    raw = sys.argv[1] if len(sys.argv) > 1 else "{}"
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        payload = {}
    result = run(payload)
    print(json.dumps(result))
