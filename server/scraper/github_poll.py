#!/usr/bin/env python3
"""Tier 3 scraper: SimplifyJobs/New-Grad-Positions commit-polled markdown table.

Polls GitHub REST API for new commits on configured repos.
Parses markdown tables from README to extract job listings.
Tracks last seen commit SHA in github_poll_state.
"""

import hashlib
import json
import re
import sys
import requests
import psycopg2
import structlog

from scraper.crypto_helper import decrypt_config


def dedup_hash(company: str, title: str, location: str) -> str:
    raw = f"{company.lower()}|{title.lower()}|{location.lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()


def parse_markdown_table(content: str):
    """Extract job rows from a SimplifyJobs-format markdown table.

    Expected columns: Company | Role | Location | Link | Date Posted
    Returns list of dicts with company, title, location, url.
    """
    jobs = []
    lines = content.split("\n")
    in_table = False
    header_indices = {}

    for line in lines:
        line = line.strip()
        if not line.startswith("|"):
            in_table = False
            header_indices = {}
            continue

        cells = [c.strip() for c in line.split("|")[1:-1]]

        # Detect header row
        if not in_table and any(
            h.lower() in ("company", "role", "location")
            for h in cells
        ):
            for i, h in enumerate(cells):
                h_lower = h.lower().strip()
                if "company" in h_lower:
                    header_indices["company"] = i
                elif "role" in h_lower or "title" in h_lower:
                    header_indices["title"] = i
                elif "location" in h_lower:
                    header_indices["location"] = i
                elif "link" in h_lower or "apply" in h_lower:
                    header_indices["url"] = i
            in_table = True
            continue

        # Skip separator row
        if in_table and all(c.replace("-", "").replace(":", "") == "" for c in cells):
            continue

        if in_table and header_indices:
            if len(cells) <= max(header_indices.values()):
                continue

            company = cells[header_indices.get("company", 0)]
            title = cells[header_indices.get("title", 1)]
            location = cells[header_indices.get("location", 2)]

            # Extract URL from markdown link syntax [text](url)
            url_cell = cells[header_indices.get("url", 3)] if "url" in header_indices else ""
            url_match = re.search(r"\[.*?\]\((.*?)\)", url_cell)
            url = url_match.group(1) if url_match else url_cell

            # Clean markdown link from company name too
            company_match = re.search(r"\[(.+?)\]", company)
            if company_match:
                company = company_match.group(1)

            # Skip closed/unavailable rows
            if "🔒" in company or "🔒" in title:
                continue

            if company and title:
                jobs.append({
                    "company": company.strip(),
                    "title": title.strip(),
                    "location": location.strip() or "Unknown",
                    "url": url.strip(),
                })

    return jobs


def poll_repo(repo: str, github_token: str | None, conn):
    cur = conn.cursor()

    # Check last known commit
    cur.execute("SELECT last_commit_sha FROM github_poll_state WHERE repo = %s", (repo,))
    row = cur.fetchone()
    last_sha = row[0] if row else None

    # Get latest commit
    headers = {"Accept": "application/vnd.github.v3+json"}
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"

    resp = requests.get(
        f"https://api.github.com/repos/{repo}/commits",
        headers=headers,
        params={"per_page": 1},
        timeout=30,
    )
    resp.raise_for_status()
    commits = resp.json()

    if not commits:
        return 0

    latest_sha = commits[0]["sha"]
    if latest_sha == last_sha:
        return 0  # No new commits

    # Fetch README content
    readme_resp = requests.get(
        f"https://api.github.com/repos/{repo}/readme",
        headers={**headers, "Accept": "application/vnd.github.v3.raw"},
        timeout=30,
    )
    readme_resp.raise_for_status()
    content = readme_resp.text

    jobs = parse_markdown_table(content)
    jobs_added = 0

    for job in jobs:
        h = dedup_hash(job["company"], job["title"], job["location"])
        cur.execute("""
            INSERT INTO jobs (source, title, company, location, url,
                             description_raw, company_role_location_hash)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (company_role_location_hash) DO NOTHING
        """, (
            "github-simplify", job["title"], job["company"],
            job["location"], job["url"],
            f"From {repo}", h
        ))
        if cur.rowcount > 0:
            jobs_added += 1

    # Update poll state
    cur.execute("""
        INSERT INTO github_poll_state (repo, last_commit_sha, last_polled_at)
        VALUES (%s, %s, NOW())
        ON CONFLICT (repo) DO UPDATE
        SET last_commit_sha = EXCLUDED.last_commit_sha,
            last_polled_at = NOW()
    """, (repo, latest_sha))

    conn.commit()
    return jobs_added


def run(db_url: str, module_config: dict):
    conn = psycopg2.connect(db_url)
    run_id = None
    total_added = 0
    errors = []

    try:
        cur = conn.cursor()
        cur.execute("SELECT config FROM user_config WHERE id = 1")
        row = cur.fetchone()
        config = decrypt_config((row[0] if row else {}) or {})
        cur.close()

        repos = config.get("github_repos", ["SimplifyJobs/New-Grad-Positions"])
        github_token = config.get("github_token")

        cur2 = conn.cursor()
        cur2.execute(
            "INSERT INTO scraper_runs (scraper_key, status, version) VALUES (%s, 'running', 'unknown') RETURNING id",
            ('github-poll',)
        )
        run_id = cur2.fetchone()[0]
        conn.commit()
        cur2.close()

        for repo in repos:
            try:
                added = poll_repo(repo, github_token, conn)
                total_added += added
            except Exception as e:
                errors.append(f"{repo}: {str(e)}")

    except Exception as e:
        # Unexpected failure (config read, run-insert, etc.) — surface with context
        errors.append(f"github_poll setup error: {str(e)}")
        raise RuntimeError(f"github_poll.run failed during setup: {e}") from e
    finally:
        # Always record completion so the monitoring page reflects every attempt
        if run_id is not None:
            try:
                cur3 = conn.cursor()
                cur3.execute(
                    "UPDATE scraper_runs SET completed_at = NOW(), jobs_found = %s, status = %s WHERE id = %s",
                    (total_added, 'failed' if errors else 'success', run_id)
                )
                conn.commit()
                cur3.close()
            except Exception:
                pass  # Don't mask the original exception
        conn.close()

    return {"jobs_added": total_added, "errors": errors}


if __name__ == "__main__":
    from scraper.log_config import configure_logging
    configure_logging()
    log = structlog.get_logger()

    config_str = sys.argv[1] if len(sys.argv) > 1 else "{}"
    payload = json.loads(config_str)

    if "db_url" not in payload:
        log.error("missing_db_url", detail="db_url not provided in JSON payload")
        sys.exit(1)

    result = run(payload["db_url"], payload)
    print(json.dumps(result))
