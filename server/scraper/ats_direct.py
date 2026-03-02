#!/usr/bin/env python3
"""Tier 2 scraper: Greenhouse, Lever, and Ashby public APIs.

Reads companies from scraped_companies table.
Calls unauthenticated public job board endpoints.
Writes to jobs table with ON CONFLICT dedup.
"""

import hashlib
import json
import sys
import requests
import psycopg2


API_ENDPOINTS = {
    "greenhouse": "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs",
    "lever": "https://api.lever.co/v0/postings/{slug}",
    "ashby": "https://api.ashbyhq.com/posting-api/job-board/{slug}",
}


def dedup_hash(company: str, title: str, location: str) -> str:
    raw = f"{company.lower()}|{title.lower()}|{location.lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()


def scrape_greenhouse(slug: str, company_name: str):
    url = API_ENDPOINTS["greenhouse"].format(slug=slug)
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    jobs = []
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
    return jobs


def scrape_lever(slug: str, company_name: str):
    url = API_ENDPOINTS["lever"].format(slug=slug)
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    jobs = []
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
    return jobs


def scrape_ashby(slug: str, company_name: str):
    url = API_ENDPOINTS["ashby"].format(slug=slug)
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    jobs = []
    for job in data.get("jobs", []):
        location = job.get("location", "Unknown")
        compensation = job.get("compensationTierSummary")
        salary_min = None
        salary_max = None
        equity_min = None
        equity_max = None
        if compensation:
            salary_min = compensation.get("salaryFloorCents")
            salary_max = compensation.get("salaryCeilingCents")
            if salary_min:
                salary_min = salary_min // 100
            if salary_max:
                salary_max = salary_max // 100
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


SCRAPERS = {
    "greenhouse": scrape_greenhouse,
    "lever": scrape_lever,
    "ashby": scrape_ashby,
}


def run(db_url: str, module_config: dict):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute("""
        SELECT name, ats_platform, ats_slug
        FROM scraped_companies
        WHERE active = true
    """)
    companies = cur.fetchall()

    jobs_added = 0
    errors = []

    for company_name, platform, slug in companies:
        scraper = SCRAPERS.get(platform)
        if not scraper:
            errors.append(f"Unknown platform: {platform}")
            continue

        try:
            scraped = scraper(slug, company_name)
            for job in scraped:
                h = dedup_hash(job["company"], job["title"], job["location"])
                cur.execute("""
                    INSERT INTO jobs (source, title, company, location, url,
                                     description_raw, salary_min, salary_max,
                                     equity_min, equity_max,
                                     company_role_location_hash)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (company_role_location_hash) DO NOTHING
                """, (
                    job["source"], job["title"], job["company"], job["location"],
                    job["url"], job["description_raw"],
                    job.get("salary_min"), job.get("salary_max"),
                    job.get("equity_min"), job.get("equity_max"), h
                ))
                if cur.rowcount > 0:
                    jobs_added += 1

            conn.commit()
        except Exception as e:
            errors.append(f"{company_name}/{platform}: {str(e)}")
            conn.rollback()

    cur.close()
    conn.close()
    return {"jobs_added": jobs_added, "errors": errors}


if __name__ == "__main__":
    config_str = sys.argv[1] if len(sys.argv) > 1 else "{}"
    payload = json.loads(config_str)
    
    if "db_url" not in payload:
        sys.stderr.write("Error: db_url not provided in JSON payload\\n")
        sys.exit(1)
        
    result = run(payload["db_url"], payload)
    print(json.dumps(result))
