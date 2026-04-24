#!/usr/bin/env python3
"""Filter module: transitions jobs from 'discovered' to 'filtered' or 'filtered-out'.

Reads `user_config.config.filter` (seniority, new_grad_only, exclude_keywords,
require_keywords) plus top-level `relevance_threshold`. Matches case-insensitively
against title + description_raw. Idempotent — only touches state='discovered' rows.
"""

import json
import re
import sys

import psycopg2

from scraper.db_connect import get_db_url


_SENIOR_SIGNALS = re.compile(
    r"\b(senior|sr\.?|staff|principal|lead|director|vp|chief|head of|architect|manager)\b",
    re.IGNORECASE,
)
_NEW_GRAD_SIGNALS = re.compile(
    r"\b(new grad|new.grad|entry.level|entry|junior|jr\.?|graduate|0[-–]?2 years)\b",
    re.IGNORECASE,
)


def _contains_any(patterns: list[str], haystack: str) -> bool:
    if not patterns:
        return False
    lower = haystack.lower()
    return any(p.lower() in lower for p in patterns if p)


def _seniority_allowed(seniority_list: list[str], title: str) -> bool:
    if not seniority_list:
        return True
    lower = title.lower()
    return any(re.search(rf"\b{re.escape(s.lower())}\b", lower) for s in seniority_list)


def run(db_url: str, module_config: dict):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute("SELECT config FROM user_config WHERE id = 1")
    row = cur.fetchone()
    config = (row[0] if row else {}) or {}
    filt = config.get("filter") or {}
    relevance_threshold = config.get("relevance_threshold")

    seniority = filt.get("seniority") or []
    new_grad_only = bool(filt.get("new_grad_only"))
    exclude_kw = filt.get("exclude_keywords") or []
    require_kw = filt.get("require_keywords") or []

    cur.execute("""
        SELECT id, title, COALESCE(description_raw, ''), relevance_score
          FROM jobs WHERE state = 'discovered'
    """)
    jobs = cur.fetchall()

    passed = 0
    dropped = 0
    errors: list[str] = []

    for job_id, title, description, score in jobs:
        try:
            reasons: list[str] = []
            blob = f"{title}\n{description}"

            if exclude_kw and _contains_any(exclude_kw, blob):
                reasons.append("exclude_keyword")
            if require_kw and not _contains_any(require_kw, blob):
                reasons.append("missing_required_keyword")
            if not _seniority_allowed(seniority, title):
                reasons.append("seniority_mismatch")
            if new_grad_only and _SENIOR_SIGNALS.search(title) and not _NEW_GRAD_SIGNALS.search(title):
                reasons.append("senior_title_blocks_new_grad_only")
            if (relevance_threshold is not None
                    and score is not None
                    and score < int(relevance_threshold)):
                reasons.append("below_relevance_threshold")

            new_state = "filtered-out" if reasons else "filtered"
            cur.execute(
                "UPDATE jobs SET state = %s WHERE id = %s AND state = 'discovered'",
                (new_state, job_id),
            )
            if cur.rowcount > 0:
                if new_state == "filtered":
                    passed += 1
                else:
                    dropped += 1
            conn.commit()
        except Exception as e:
            errors.append(f"job_id={job_id}: {e}")
            conn.rollback()

    cur.close()
    conn.close()
    return {"passed": passed, "dropped": dropped, "errors": errors}


if __name__ == "__main__":
    payload = json.loads(sys.argv[1] if len(sys.argv) > 1 else "{}")
    print(json.dumps(run(get_db_url(payload), payload)))
