#!/usr/bin/env python3
"""Tier 2 scraper: Greenhouse, Lever, and Ashby public APIs.

Refactored to inherit from BaseScraper (Scrapling HTTPX backend) 
instead of raw requests for a unified pipeline.
"""

import json
import sys
import psycopg2
from base_scraper import BaseScraper


def get_api_endpoint(platform: str, slug: str) -> str:
    """Get the API endpoint URL for the given platform and company slug"""
    endpoints = {
        "greenhouse": f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs",
        "lever": f"https://api.lever.co/v0/postings/{slug}",
        "ashby": f"https://api.ashbyhq.com/posting-api/job-board/{slug}",
    }
    return endpoints.get(platform, "")


class ATSScraper(BaseScraper):
    def __init__(self, db_url: str):
        super().__init__(db_url, 'ats-direct', use_stealth=False)

    def extract_jobs(self, platform: str, slug: str, company_name: str) -> list:
        url = get_api_endpoint(platform, slug)
        if not url:
            return []
        resp = self.fetch_with_retry(url)

        try:
            data = resp.json()
        except json.JSONDecodeError:
            return []

        jobs = []
        if platform == "greenhouse":
            for job in data.get("jobs", []):
                location = job.get("location", {}).get("name", "Unknown")
                jobs.append({
                    "source": "ats-greenhouse",
                    "title": job.get("title", ""),
                    "company": company_name,
                    "location": location,
                    "url": job.get("absolute_url", ""),
                    "description_raw": job.get("content", ""),
                })
        elif platform == "lever":
            for posting in data:
                location = posting.get("categories", {}).get("location", "Unknown")
                jobs.append({
                    "source": "ats-lever",
                    "title": posting.get("text", ""),
                    "company": company_name,
                    "location": location,
                    "url": posting.get("hostedUrl", ""),
                    "description_raw": posting.get("descriptionPlain", ""),
                })
        elif platform == "ashby":
            for job in data.get("jobs", []):
                location = job.get("location", "Unknown")
                compensation = job.get("compensationTierSummary")
                salary_min, salary_max, equity_min, equity_max = None, None, None, None
                
                if compensation:
                    salary_min = compensation.get("salaryFloorCents")
                    salary_max = compensation.get("salaryCeilingCents")
                    if salary_min: salary_min = salary_min // 100
                    if salary_max: salary_max = salary_max // 100
                    equity_min = compensation.get("equityPercentageFloor")
                    equity_max = compensation.get("equityPercentageCeiling")

                jobs.append({
                    "source": "ats-ashby",
                    "title": job.get("title", ""),
                    "company": company_name,
                    "location": location,
                    "url": job.get("jobUrl", ""),
                    "description_raw": job.get("descriptionPlain", ""),
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "equity_min": equity_min,
                    "equity_max": equity_max,
                })
                
        return jobs


def _mark_removed_jobs(conn, source: str, company_name: str, current_urls: set):
    """Mark jobs that disappeared from the ATS API as dead.

    ATS APIs only return currently-open positions. Any previously-discovered
    job from this source+company that is no longer in the response has been
    filled or closed — more reliable than HTTP liveness checks.
    """
    if not current_urls:
        return 0
    cur = conn.cursor()
    placeholders = ",".join(["%s"] * len(current_urls))
    cur.execute(
        f"""
        UPDATE jobs
        SET is_live = false, liveness_checked_at = NOW()
        WHERE source = %s
          AND company = %s
          AND is_live = true
          AND state IN ('discovered', 'filtered', 'queued')
          AND url NOT IN ({placeholders})
        """,
        (source, company_name, *current_urls),
    )
    removed = cur.rowcount
    conn.commit()
    cur.close()
    return removed


def run(db_url: str, module_config: dict):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute("""
        SELECT name, ats_platform, ats_slug
        FROM scraped_companies
        WHERE active = true
    """)
    companies = cur.fetchall()
    cur.close()

    scraper = ATSScraper(db_url)
    jobs_added = 0
    jobs_removed = 0
    errors = []

    for company_name, platform, slug in companies:
        try:
            scraped = scraper.extract_jobs(platform, slug, company_name)
            jobs_added += scraper.save_jobs(scraped)
            # Detect filled/closed positions by comparing API response to DB
            source = f"ats-{platform}"
            current_urls = {j["url"] for j in scraped if j.get("url")}
            if current_urls:
                jobs_removed += _mark_removed_jobs(conn, source, company_name, current_urls)
        except Exception as e:
            errors.append(f"{company_name}/{platform}: {str(e)}")

    conn.close()
    return {"jobs_added": jobs_added, "jobs_removed": jobs_removed, "errors": errors}


if __name__ == "__main__":
    from scraper.db_connect import get_db_url

    config_str = sys.argv[1] if len(sys.argv) > 1 else "{}"
    payload = json.loads(config_str)

    result = run(get_db_url(payload), payload)
    print(json.dumps(result))
