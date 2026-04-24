#!/usr/bin/env python3
"""Notifications module: POST a summary to ntfy.sh.

Runs last in the orchestrator. Reads `user_config.config.ntfy_topic`; takes
`title`, `message`, `priority`, `tags` from module_config. If the orchestrator
doesn't supply a message, falls back to counting jobs that passed filtering
in the last hour.
"""

import json
import sys
import urllib.error
import urllib.request

import psycopg2

from scraper.db_connect import get_db_url


def _fallback_message(cur) -> str:
    cur.execute("""
        SELECT count(*) FROM jobs
         WHERE state = 'filtered'
           AND discovered_at > NOW() - INTERVAL '1 hour'
    """)
    (count,) = cur.fetchone()
    return f"{count} new jobs passed filtering in the last hour"


def run(db_url: str, module_config: dict):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute("SELECT config FROM user_config WHERE id = 1")
    row = cur.fetchone()
    cfg = (row[0] if row else {}) or {}
    topic = cfg.get("ntfy_topic")

    if not topic:
        cur.close()
        conn.close()
        return {"sent": False, "reason": "ntfy_topic not configured"}

    title = module_config.get("title") or "Notiapply"
    message = module_config.get("message") or _fallback_message(cur)
    priority = str(module_config.get("priority", "default"))
    tags = module_config.get("tags")

    cur.close()
    conn.close()

    headers = {"Title": title, "Priority": priority}
    if tags:
        headers["Tags"] = ",".join(tags) if isinstance(tags, list) else str(tags)

    req = urllib.request.Request(
        f"https://ntfy.sh/{topic}",
        data=message.encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return {"sent": True, "topic": topic, "status": resp.status, "message_length": len(message)}
    except urllib.error.HTTPError as e:
        return {"sent": False, "error": f"HTTP {e.code} {e.reason}"}
    except Exception as e:
        return {"sent": False, "error": str(e)}


if __name__ == "__main__":
    payload = json.loads(sys.argv[1] if len(sys.argv) > 1 else "{}")
    print(json.dumps(run(get_db_url(payload), payload)))
