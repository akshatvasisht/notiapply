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
    proxy = config.get("decodo_proxy")

    # Module-level config overrides
    sources = module_config.get("sources", ["linkedin", "indeed", "glassdoor", "zip_recruiter"])
    results_per_source = module_config.get("results_per_source", 50)

    jobs_added = 0
    errors = []

    for term in search_terms:
        for loc in locations:
            try:
                results = scrape_jobs(
                    site_name=sources,
                    search_term=term,
                    location=loc,
                    results_wanted=results_per_source,
                    proxy=f"http://{proxy}" if proxy else None,
                )

                for _, row in results.iterrows():
                    source_name = f"jobspy-{row.get('site', 'unknown')}"
                    company = str(row.get("company", "Unknown"))
                    title = str(row.get("title", "Unknown"))
                    job_location = str(row.get("location", loc))
                    url = str(row.get("job_url", ""))
                    description = str(row.get("description", ""))
                    salary_min = int(row["min_amount"]) if row.get("min_amount") else None
                    salary_max = int(row["max_amount"]) if row.get("max_amount") else None
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
