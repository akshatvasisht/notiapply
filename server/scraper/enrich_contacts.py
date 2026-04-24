"""Contact enrichment module.

For each contact with a personal_url and enrichment_status IN ('pending','failed'):
    1. Fetch the page via scrapling (+ SSRF guard against internal IPs).
    2. Extract clean markdown via trafilatura (EnrichmentProcessor).
    3. Ask an LLM to extract structured facts (summary, topics, tech_stack, recent_themes).
    4. Persist to contacts.enrichment, flip enrichment_status to 'completed' / 'failed'.

Runner contract:
    python enrich_contacts.py '<json_payload>'

Payload keys (all optional):
    db_url         Postgres DSN (auto-injected by runner from DATABASE_URL env)
    batch_size     Max contacts per run (default 10, max 100)
    rate_limit_s   Per-URL delay in seconds (default 2)

Emits a trailing JSON line to stdout:
    {"enriched": N, "failed": M, "skipped_guard": K, "errors": [...]}
"""

from __future__ import annotations

import ipaddress
import json
import os
import socket
import sys
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

import psycopg2

from scraper.crypto_helper import decrypt_config
from scraper.enrichment.yc_enrichment import fetch_yc_company


def _default_processor():
    """Lazy-import EnrichmentProcessor so unit tests don't pull the full
    scrapling + playwright stack at collection time."""
    from scraper.enrichment.crawler import EnrichmentProcessor  # noqa: WPS433
    return EnrichmentProcessor()


ENRICHMENT_SCHEMA_VERSION = 1

_SYSTEM_PROMPT = (
    "You are a concise data extractor. Given a person's personal website or blog "
    "in markdown, return structured JSON only — no prose, no code fences."
)

_USER_PROMPT_TEMPLATE = """Extract structured facts from this personal website.

Return JSON with exactly these keys (all required):
  summary:        String, <=200 chars. Who this person is, in one sentence.
  topics:         Array of 3-7 short topic/interest labels.
  tech_stack:     Array of technologies mentioned (languages, tools, frameworks). Empty array if none.
  recent_themes:  Array of 2-4 short phrases describing what they've been writing/building about lately.

Return nothing but valid JSON.

---

{markdown}
"""


_BLOCKED_HOSTS = {"localhost", "metadata.google.internal", "metadata"}


# ──────────────────────────────────────────────────────────────────────────────
# SSRF guard
# ──────────────────────────────────────────────────────────────────────────────


def _url_is_safe(url: str) -> Tuple[bool, str]:
    """Return (ok, reason). Reject non-http(s), link-local, RFC1918, metadata endpoints."""
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception as exc:  # noqa: BLE001
        return False, f"unparsable url: {exc}"

    if parsed.scheme not in ("http", "https"):
        return False, f"scheme not allowed: {parsed.scheme}"

    host = (parsed.hostname or "").lower()
    if not host:
        return False, "no host"
    if host in _BLOCKED_HOSTS:
        return False, f"host on blocklist: {host}"

    # Resolve and check every address. Any private/link-local/loopback address → reject.
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        return False, f"dns resolve failed: {exc}"

    for info in infos:
        ip_str = info[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
            return False, f"host resolves to non-public ip: {ip_str}"

    return True, ""


# ──────────────────────────────────────────────────────────────────────────────
# LLM
# ──────────────────────────────────────────────────────────────────────────────


def _build_llm_request(cfg: Dict[str, Any], markdown: str) -> Tuple[Dict[str, str], Dict[str, Any]]:
    """OpenAI-compatible chat-completions. See doc_generation._build_llm_request for rationale."""
    model = cfg.get("llm_model") or "gemini-1.5-flash"
    user_prompt = _USER_PROMPT_TEMPLATE.format(markdown=markdown[:12000])  # cap context

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {cfg.get('llm_api_key') or ''}",
    }
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 500,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    return headers, body


def _extract_text(data: Dict[str, Any]) -> str:
    return data["choices"][0]["message"]["content"].strip()


def _call_llm(endpoint: str, headers: Dict[str, str], body: Dict[str, Any], timeout: int = 30) -> Dict[str, Any]:
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _parse_enrichment(raw: str) -> Optional[Dict[str, Any]]:
    """Parse LLM output into our enrichment shape. Returns None on malformed."""
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        # Occasionally wrapped in ```json ... ``` — strip fences and retry.
        stripped = raw.strip().strip("`")
        if stripped.startswith("json"):
            stripped = stripped[4:].lstrip()
        try:
            obj = json.loads(stripped)
        except json.JSONDecodeError:
            return None
    if not isinstance(obj, dict):
        return None
    required = {"summary", "topics", "tech_stack", "recent_themes"}
    if not required.issubset(obj.keys()):
        return None
    return {
        "schema_version": ENRICHMENT_SCHEMA_VERSION,
        "summary": str(obj.get("summary", ""))[:240],
        "topics": [str(t) for t in (obj.get("topics") or [])][:10],
        "tech_stack": [str(t) for t in (obj.get("tech_stack") or [])][:30],
        "recent_themes": [str(t) for t in (obj.get("recent_themes") or [])][:6],
    }


# ──────────────────────────────────────────────────────────────────────────────
# Runner entry point
# ──────────────────────────────────────────────────────────────────────────────


def _load_llm_config(cur) -> Dict[str, Any]:
    cur.execute("SELECT config FROM user_config WHERE id = 1")
    row = cur.fetchone()
    return decrypt_config((row[0] if row else {}) or {})


def run(payload: Dict[str, Any], *, processor=None) -> Dict[str, Any]:
    db_url = payload.get("db_url") or os.environ.get("DATABASE_URL")
    if not db_url:
        return {"enriched": 0, "failed": 0, "skipped_guard": 0, "errors": ["db_url missing"]}

    batch_size = max(1, min(int(payload.get("batch_size", 10)), 100))
    rate_limit_s = max(0.0, float(payload.get("rate_limit_s", 2)))
    # Stale-refresh cadence. A completed row whose `enriched_at` is older than
    # this gets requeued automatically. 0 disables stale refresh (legacy
    # behavior: only pending/failed are picked up).
    refresh_days = max(0, int(payload.get("refresh_days", 90)))

    errors: List[str] = []
    enriched = 0
    failed = 0
    skipped_guard = 0

    conn = psycopg2.connect(db_url)
    try:
        cur = conn.cursor()
        cfg = _load_llm_config(cur)
        endpoint = cfg.get("llm_endpoint")
        api_key = cfg.get("llm_api_key")
        if not endpoint or not api_key:
            return {
                "enriched": 0,
                "failed": 0,
                "skipped_guard": 0,
                "errors": ["LLM endpoint/api_key not configured in user_config"],
            }

        if processor is None:
            processor = _default_processor()

        # Include `completed` rows whose enrichment has gone stale (enriched_at
        # older than refresh_days). When refresh_days=0 the second clause is
        # logically false, reducing to the original pending/failed SELECT.
        cur.execute(
            """
            SELECT id, personal_url, company_name
              FROM contacts
             WHERE (enrichment_status IN ('pending', 'failed')
                    OR (enrichment_status = 'completed'
                        AND %s > 0
                        AND enriched_at IS NOT NULL
                        AND enriched_at < NOW() - (%s || ' days')::interval))
               AND personal_url IS NOT NULL
               AND personal_url <> ''
             ORDER BY enrichment_status = 'pending' DESC,  -- pending first
                      enriched_at NULLS FIRST,             -- then oldest stale
                      created_at DESC
             LIMIT %s
            """,
            (refresh_days, str(refresh_days), batch_size),
        )
        rows = cur.fetchall()
        cur.close()

        for contact_id, personal_url, contact_company_name in rows:
            # Fast-path: YC API returns structured data for YC-backed companies,
            # bypassing the LLM + crawler entirely. Free, rate-unlimited.
            if contact_company_name:
                try:
                    yc_data = fetch_yc_company(contact_company_name)
                except Exception as exc:  # noqa: BLE001
                    yc_data = None
                    errors.append(f"yc api {contact_id}: {exc}")

                if yc_data:
                    enrichment = {
                        "schema_version": ENRICHMENT_SCHEMA_VERSION,
                        "summary": (yc_data.get("description") or "")[:240],
                        "topics": [],
                        "tech_stack": [],
                        "recent_themes": [],
                        "yc_meta": yc_data,
                    }
                    _mark_completed(conn, contact_id, enrichment)
                    enriched += 1
                    print(
                        f"enrich-contacts: contact #{contact_id} enriched via YC fast-path",
                        file=sys.stderr,
                    )
                    if rate_limit_s:
                        time.sleep(rate_limit_s)
                    continue

            ok, reason = _url_is_safe(personal_url)
            if not ok:
                skipped_guard += 1
                _mark_skipped(conn, contact_id, reason)
                continue

            try:
                markdown = processor.enrich_url(personal_url)
            except Exception as exc:  # noqa: BLE001
                failed += 1
                errors.append(f"fetch {personal_url}: {exc}")
                _mark_failed(conn, contact_id)
                continue

            try:
                headers, body = _build_llm_request(cfg, markdown)
                data = _call_llm(endpoint, headers, body)
                raw_text = _extract_text(data)
            except Exception as exc:  # noqa: BLE001
                failed += 1
                errors.append(f"llm {contact_id}: {exc}")
                _mark_failed(conn, contact_id)
                continue

            parsed = _parse_enrichment(raw_text)
            if parsed is None:
                failed += 1
                errors.append(f"parse {contact_id}: LLM returned malformed JSON")
                _mark_failed(conn, contact_id)
                continue

            _mark_completed(conn, contact_id, parsed)
            enriched += 1
            print(f"enrich-contacts: contact #{contact_id} enriched", file=sys.stderr)

            if rate_limit_s:
                time.sleep(rate_limit_s)

    finally:
        conn.close()

    return {
        "enriched": enriched,
        "failed": failed,
        "skipped_guard": skipped_guard,
        "errors": errors,
    }


def _mark_completed(conn, contact_id: int, enrichment: Dict[str, Any]) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE contacts
               SET enrichment = %s::jsonb,
                   enrichment_status = 'completed',
                   enriched_at = NOW()
             WHERE id = %s
            """,
            (json.dumps(enrichment), contact_id),
        )
    conn.commit()


def _mark_failed(conn, contact_id: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE contacts
               SET enrichment_status = 'failed',
                   enriched_at = NOW()
             WHERE id = %s
            """,
            (contact_id,),
        )
    conn.commit()


def _mark_skipped(conn, contact_id: int, reason: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE contacts
               SET enrichment_status = 'skipped',
                   enriched_at = NOW()
             WHERE id = %s
            """,
            (contact_id,),
        )
    conn.commit()
    print(f"enrich-contacts: skip #{contact_id} ({reason})", file=sys.stderr)


if __name__ == "__main__":
    raw_payload = sys.argv[1] if len(sys.argv) > 1 else "{}"
    try:
        payload = json.loads(raw_payload)
    except json.JSONDecodeError:
        payload = {}
    result = run(payload)
    print(json.dumps(result))
