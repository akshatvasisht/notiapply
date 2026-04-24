#!/usr/bin/env python3
"""Tier 1 scraper: LinkedIn, Indeed, Glassdoor, ZipRecruiter via speedyapply/JobSpy.

Called by n8n Execute Workflow node with module_config from pipeline_modules.
Reads search terms and locations from user_config.
Writes to the jobs table with ON CONFLICT dedup.
"""

import hashlib
import json
import sys
import psycopg2
from jobspy import scrape_jobs


def dedup_hash(company: str, title: str, location: str) -> str:
    raw = f"{company.lower()}|{title.lower()}|{location.lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()


def run(db_url: str, module_config: dict):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    # Read user config for search terms and locations
    cur.execute("SELECT config FROM user_config WHERE id = 1")
    config = cur.fetchone()[0]

    search_terms = config.get("search_terms", ["software engineer"])
    locations = config.get("locations", ["Remote"])

    # No proxy required: JobSpy operates under typical single-user request volumes
    # Wellfound (Tier 4) bypasses Cloudflare via Scrapling+Camoufox fingerprint spoofing,
    # not a residential proxy. JobSpy's LinkedIn/Indeed scraping does not require a proxy
    # at the volumes a single applicant generates.
    sources = module_config.get("sources", ["linkedin", "indeed", "glassdoor", "zip_recruiter"])
    results_per_source = module_config.get("results_per_source", 50)
    hours_old = module_config.get("hours_old", 72)  # Only fetch postings from last 72 hours

    jobs_added = 0
    errors = []

    # Start run tracking so monitoring page shows JobSpy history
    cur.execute(
        "INSERT INTO scraper_runs (scraper_key, status, version) VALUES (%s, 'running', 'unknown') RETURNING id",
        ('jobspy',)
    )
    run_id = cur.fetchone()[0]
    conn.commit()

    try:
        for term in search_terms:
            for loc in locations:
                try:
                    results = scrape_jobs(
                        site_name=sources,
                        search_term=term,
                        location=loc,
                        results_wanted=results_per_source,
                        hours_old=hours_old,
                    )

                    for _, row in results.iterrows():
                        source_name = f"jobspy-{row.get('site', 'unknown')}"
                        company = str(row.get("company", "Unknown"))
                        title = str(row.get("title", "Unknown"))
                        job_location = str(row.get("location", loc))
                        url = str(row.get("job_url", ""))
                        description = str(row.get("description", ""))
                        try:
                            salary_min = int(row["min_amount"]) if row.get("min_amount") else None
                        except (ValueError, TypeError):
                            salary_min = None
                        try:
                            salary_max = int(row["max_amount"]) if row.get("max_amount") else None
                        except (ValueError, TypeError):
                            salary_max = None
                        h = dedup_hash(company, title, job_location)

                        cur.execute("""
                            INSERT INTO jobs (source, title, company, location, url,
                                             description_raw, salary_min, salary_max,
                                             company_role_location_hash)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (company_role_location_hash) DO NOTHING
                        """, (source_name, title, company, job_location, url,
                              description, salary_min, salary_max, h))

                        if cur.rowcount > 0:
                            jobs_added += 1

                    conn.commit()
                except Exception as e:
                    errors.append(f"{term}/{loc}: {str(e)}")
                    conn.rollback()
    finally:
        # Always record completion — even if an unhandled exception propagates
        final_status = 'failed' if errors else 'success'
        cur.execute(
            "UPDATE scraper_runs SET completed_at = NOW(), jobs_found = %s, status = %s WHERE id = %s",
            (jobs_added, final_status, run_id)
        )
        conn.commit()
        cur.close()
        conn.close()

    return {"jobs_added": jobs_added, "errors": errors}


if __name__ == "__main__":
    from scraper.db_connect import get_db_url

    config_str = sys.argv[1] if len(sys.argv) > 1 else "{}"
    payload = json.loads(config_str)

    result = run(get_db_url(payload), payload)
    print(json.dumps(result))
