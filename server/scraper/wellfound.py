#!/usr/bin/env python3
"""Tier 4 scraper: Wellfound via CF-Clearance-Scraper + GraphQL __NEXT_DATA__ extraction.

Best-effort. Cookie expires every 30 minutes, bound to Oracle's IP.
Breaks periodically when Cloudflare updates detection rules.
"""

import hashlib
import json
import re
import subprocess
import sys
import requests
import psycopg2


def dedup_hash(company: str, title: str, location: str) -> str:
    raw = f"{company.lower()}|{title.lower()}|{location.lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()


def get_cf_clearance(target_url: str) -> dict:
    """Run CF-Clearance-Scraper to obtain cf_clearance cookie and user agent."""
    result = subprocess.run(
        [
            "python3", "/opt/cf-clearance-scraper/main.py",
            "-u", target_url,
            "--headless",
        ],
        capture_output=True, text=True, timeout=60,
    )

    if result.returncode != 0:
        raise RuntimeError(f"CF-Clearance-Scraper failed: {result.stderr.strip()}")

    output = json.loads(result.stdout.strip())
    return {
        "cf_clearance": output["cf_clearance"],
        "user_agent": output["user_agent"],
    }


def scrape_wellfound_listings(search_terms: list[str], locations: list[str], clearance: dict):
    """Scrape Wellfound job listings using __NEXT_DATA__ extraction."""
    jobs = []
    session = requests.Session()
    session.headers.update({
        "User-Agent": clearance["user_agent"],
        "Cookie": f"cf_clearance={clearance['cf_clearance']}",
    })

    for term in search_terms:
        slug = term.lower().replace(" ", "-")
        url = f"https://wellfound.com/role/l/{slug}/united-states"

        try:
            resp = session.get(url, timeout=30)
            resp.raise_for_status()

            # Extract __NEXT_DATA__ JSON blob from the page HTML
            match = re.search(
                r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
                resp.text,
                re.DOTALL,
            )
            if not match:
                continue

            next_data = json.loads(match.group(1))

            # Navigate the __NEXT_DATA__ structure to find job listings
            props = next_data.get("props", {}).get("pageProps", {})
            listings = props.get("listings", [])
            if not listings:
                # Try alternative paths
                ssg_data = props.get("urqlState", {})
                for key, val in ssg_data.items():
                    if isinstance(val, dict) and "data" in val:
                        data = json.loads(val["data"]) if isinstance(val["data"], str) else val["data"]
                        if "startupResults" in data:
                            for startup in data["startupResults"].get("results", []):
                                for highlight_listing in startup.get("highlightedJobListings", []):
                                    company_name = startup.get("name", "Unknown")
                                    location = highlight_listing.get("locationNames", ["Unknown"])
                                    location = ", ".join(location) if isinstance(location, list) else location
                                    equity_text = highlight_listing.get("equity")
                                    equity_min = None
                                    equity_max = None
                                    if equity_text:
                                        equity_match = re.findall(r"(\d+\.?\d*)%", str(equity_text))
                                        if len(equity_match) >= 2:
                                            equity_min = float(equity_match[0])
                                            equity_max = float(equity_match[1])

                                    jobs.append({
                                        "source": "wellfound",
                                        "title": highlight_listing.get("title", ""),
                                        "company": company_name,
                                        "location": location,
                                        "url": f"https://wellfound.com/jobs/{highlight_listing.get('slug', '')}",
                                        "description_raw": highlight_listing.get("description", ""),
                                        "salary_min": highlight_listing.get("compensation"),
                                        "salary_max": None,
                                        "equity_min": equity_min,
                                        "equity_max": equity_max,
                                    })

        except Exception:
            continue

    return jobs


def run(db_url: str, module_config: dict):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute("SELECT config FROM user_config WHERE id = 1")
    config = cur.fetchone()[0]

    search_terms = config.get("search_terms", ["software engineer"])
    locations = config.get("locations", ["Remote"])

    errors = []
    jobs_added = 0

    try:
        clearance = get_cf_clearance("https://wellfound.com")
    except Exception as e:
        cur.close()
        conn.close()
        return {"jobs_added": 0, "errors": [f"CF-Clearance failed: {str(e)}"]}

    try:
        scraped = scrape_wellfound_listings(search_terms, locations, clearance)
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
        errors.append(str(e))
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
