#!/usr/bin/env python3
"""Ghost job / stale posting detection.

Called by n8n Execute Workflow node with JSON config from argv[1].
Checks jobs in active states to see if their postings are still live.
Marks dead postings as filtered-out without clobbering terminal states.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

import psycopg2
import structlog

# Phrases that indicate a job posting is no longer accepting applications
DEAD_PHRASES = [
    "no longer accepting applications",
    "position has been filled",
    "this job is no longer available",
    "job listing has expired",
    "application closed",
    "this position is closed",
    "this role has been filled",
    "this job has been closed",
    "no longer available",
    "posting has been removed",
    "this requisition is no longer active",
    "job is closed",
]

# States where jobs are still actionable and worth checking
ACTIVE_STATES = ("discovered", "filtered", "queued")

# States that must never be overwritten by liveness checks
TERMINAL_STATES = ("submitted", "rejected", "tracking")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def _make_opener():
    """Build a urllib opener that does not auto-follow redirects."""
    class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    return urllib.request.build_opener(NoRedirectHandler())


def _redirect_looks_dead(original_url: str, redirect_url: str, company: str) -> bool:
    """Heuristic: redirect target is a generic listing page, not the specific job."""
    company_slug = company.lower().replace(" ", "").replace("-", "")
    redirect_lower = redirect_url.lower()

    # If the company name (slugified) appears in the redirect URL, probably still live
    if company_slug and company_slug in redirect_lower.replace("-", "").replace("_", ""):
        return False

    # Check whether any meaningful path component from the original URL survived
    from urllib.parse import urlparse
    orig_path_parts = [p for p in urlparse(original_url).path.split("/") if len(p) > 4]
    redir_path = urlparse(redirect_url).path
    for part in orig_path_parts:
        if part in redir_path:
            return False

    # Redirect to root or a generic /jobs page → dead
    redir_path_stripped = redir_path.strip("/")
    if redir_path_stripped in ("", "jobs", "careers", "job-search", "positions"):
        return True

    return True  # When in doubt, treat redirects to unrelated paths as dead


def check_url(url: str, company: str) -> tuple[bool, str]:
    """
    Returns (is_dead, reason).
    is_dead=None means unknown (network error — do not mark dead).
    """
    opener = _make_opener()
    req_head = urllib.request.Request(
        url,
        method="HEAD",
        headers={"User-Agent": USER_AGENT},
    )

    try:
        with opener.open(req_head, timeout=5) as resp:
            status = resp.status

            if status in (404, 410):
                return True, f"HTTP {status}"

            if status in (301, 302):
                location = resp.headers.get("Location", "")
                if location and _redirect_looks_dead(url, location, company):
                    return True, f"redirect to generic listing ({location})"
                return False, "redirect (looks live)"

            if status == 200:
                # Fetch first 2KB of body to scan for dead-job phrases
                req_get = urllib.request.Request(
                    url,
                    method="GET",
                    headers={
                        "User-Agent": USER_AGENT,
                        "Range": "bytes=0-9999",
                    },
                )
                try:
                    with opener.open(req_get, timeout=10) as body_resp:
                        raw = body_resp.read(10000).decode("utf-8", errors="ignore").lower()
                        for phrase in DEAD_PHRASES:
                            if phrase in raw:
                                return True, f"body contains '{phrase}'"
                except Exception:
                    pass  # Body fetch failed — fall through to live

                return False, "200 OK"

            # Any other 2xx/3xx — assume live
            return False, f"HTTP {status}"

    except urllib.error.HTTPError as exc:
        if exc.code in (404, 410):
            return True, f"HTTP {exc.code}"
        return None, f"HTTP error {exc.code}"

    except Exception as exc:
        return None, str(exc)


def main():
    from scraper.log_config import configure_logging
    configure_logging()
    log = structlog.get_logger()

    config = json.loads(sys.argv[1] if len(sys.argv) > 1 else "{}")
    db_url = config.get("db_url")

    if not db_url:
        log.error("missing_db_url", detail="db_url not provided in JSON payload")
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    # Track run for monitoring page
    cur.execute(
        "INSERT INTO scraper_runs (scraper_key, status, version) VALUES (%s, 'running', 'unknown') RETURNING id",
        ('liveness-check',)
    )
    run_id = cur.fetchone()[0]
    conn.commit()

    # Re-check TTL: jobs checked more than 7 days ago are eligible for re-check.
    # Unchecked jobs (NULL) are prioritized first, then stale checks, then recent.
    recheck_days = config.get("recheck_days", 7)
    batch_limit = config.get("batch_limit", 200)
    check_delay = config.get("check_delay", 1.0)
    state_placeholders = ",".join(["%s"] * len(ACTIVE_STATES))
    cur.execute(
        f"""
        SELECT id, url, company
        FROM jobs
        WHERE state IN ({state_placeholders})
          AND is_live = true
          AND url IS NOT NULL
          AND url <> ''
          AND (liveness_checked_at IS NULL
               OR liveness_checked_at < NOW() - (%s || ' days')::INTERVAL)
        ORDER BY liveness_checked_at NULLS FIRST, discovered_at DESC
        LIMIT %s
        """,
        (*ACTIVE_STATES, str(recheck_days), batch_limit),
    )
    rows = cur.fetchall()

    dead_count = 0
    live_count = 0
    errors = []
    consecutive_errors = 0

    for job_id, url, company in rows:
        company = company or ""
        is_dead, reason = check_url(url, company)

        if is_dead is True:
            # Mark dead — never clobber terminal states
            terminal_placeholders = ",".join(["%s"] * len(TERMINAL_STATES))
            cur.execute(
                f"""
                UPDATE jobs
                SET is_live = false,
                    liveness_checked_at = NOW(),
                    state = 'filtered-out'
                WHERE id = %s
                  AND state NOT IN ({terminal_placeholders})
                """,
                (job_id, *TERMINAL_STATES),
            )
            conn.commit()
            dead_count += 1
            consecutive_errors = 0
            log.info("dead_posting", job_id=job_id, reason=reason)

        elif is_dead is False:
            cur.execute(
                "UPDATE jobs SET liveness_checked_at = NOW() WHERE id = %s",
                (job_id,),
            )
            conn.commit()
            live_count += 1
            consecutive_errors = 0

        else:
            # Unknown / network error — log and skip, don't mark dead
            errors.append({"job_id": job_id, "url": url, "error": reason})
            log.error("liveness_check_error", job_id=job_id, error=reason)
            consecutive_errors += 1
            # Back off if too many consecutive errors (possible rate limiting)
            if consecutive_errors >= 5:
                log.warning("backing_off", consecutive_errors=consecutive_errors)
                time.sleep(check_delay * 5)

        time.sleep(check_delay)

    # Record run completion
    final_status = 'failed' if len(errors) > len(rows) // 2 else 'success'
    cur.execute(
        "UPDATE scraper_runs SET completed_at = NOW(), jobs_found = %s, status = %s WHERE id = %s",
        (dead_count, final_status, run_id)
    )
    conn.commit()

    cur.close()
    conn.close()

    result = {"dead_jobs": dead_count, "live_jobs": live_count, "errors": errors}
    print(json.dumps(result))


if __name__ == "__main__":
    main()
