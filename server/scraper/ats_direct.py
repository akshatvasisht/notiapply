#!/usr/bin/env python3
"""Tier 2 scraper: Greenhouse, Lever, and Ashby public APIs.

Refactored to inherit from BaseScraper (Scrapling HTTPX backend) 
instead of raw requests for a unified pipeline.
"""

import json
import sys
import psycopg2
from base_scraper import BaseScraper


API_ENDPOINTS = {
    "greenhouse": "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs",
    "lever": "https://api.lever.co/v0/postings/{slug}",
    "ashby": "https://api.ashbyhq.com/posting-api/job-board/{slug}",
}


class ATSScraper(BaseScraper):
    def __init__(self, db_url: str):
        super().__init__(db_url, use_stealth=False)
        
    def extract_jobs(self, platform: str, slug: str, company_name: str) -> list:
        url_template = API_ENDPOINTS.get(platform)
        if not url_template:
            return []
            
        url = url_template.format(slug=slug)
        resp = self.fetcher.get(url)

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
    conn.close()

    scraper = ATSScraper(db_url)
    jobs_added = 0
    errors = []

    for company_name, platform, slug in companies:
        try:
            scraped = scraper.extract_jobs(platform, slug, company_name)
            jobs_added += scraper.save_jobs(scraped)
        except Exception as e:
            errors.append(f"{company_name}/{platform}: {str(e)}")

    return {"jobs_added": jobs_added, "errors": errors}


if __name__ == "__main__":
    config_str = sys.argv[1] if len(sys.argv) > 1 else "{}"
    payload = json.loads(config_str)
    
    if "db_url" not in payload:
        sys.stderr.write("Error: db_url not provided in JSON payload\\n")
        sys.exit(1)
        
    result = run(payload["db_url"], payload)
    print(json.dumps(result))
