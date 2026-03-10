#!/usr/bin/env python3
"""Tier 4 scraper: Wellfound via Scrapling + Camoufox.

We now use Scrapling and its integration with Camoufox to bypass Cloudflare transparently,
extracting the __NEXT_DATA__ JSON blob without needing a separate cf-clearance loop.
"""

import json
import re
import sys
import psycopg2
from base_scraper import BaseScraper


class WellfoundScraper(BaseScraper):
    def __init__(self, db_url: str):
        super().__init__(db_url, use_stealth=True)
        
    def extract_jobs(self, search_terms: list, locations: list) -> list:
        jobs = []
        for term in search_terms:
            slug = term.lower().replace(" ", "-")
            url = f"https://wellfound.com/role/l/{slug}/united-states"
            
            try:
                resp = self.fetcher.get(url)
                
                next_data_script = resp.css('script#__NEXT_DATA__')
                if not next_data_script:
                    continue
                
                next_data = json.loads(next_data_script[0].text)
                props = next_data.get("props", {}).get("pageProps", {})
                
                ssg_data = props.get("urqlState", {})
                for key, val in ssg_data.items():
                    if isinstance(val, dict) and "data" in val:
                        data = json.loads(val["data"]) if isinstance(val["data"], str) else val["data"]
                        if "startupResults" in data:
                            for startup in data["startupResults"].get("results", []):
                                for highlight_listing in startup.get("highlightedJobListings", []):
                                    company_name = startup.get("name", "Unknown")
                                    raw_locations = highlight_listing.get("locationNames", ["Unknown"])
                                    loc_str = ", ".join(raw_locations) if isinstance(raw_locations, list) else raw_locations
                                    
                                    equity_text = highlight_listing.get("equity")
                                    equity_min, equity_max = None, None
                                    if equity_text:
                                        equity_match = re.findall(r"(\d+\.?\d*)%", str(equity_text))
                                        if len(equity_match) >= 2:
                                            equity_min = float(equity_match[0])
                                            equity_max = float(equity_match[1])

                                    jobs.append({
                                        "source": "wellfound",
                                        "title": highlight_listing.get("title", ""),
                                        "company": company_name,
                                        "location": loc_str,
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
    cur.close()
    conn.close()

    search_terms = config.get("search_terms", [])
    locations = config.get("locations", [])

    scraper = WellfoundScraper(db_url)
    errors = []
    jobs_added = 0
    
    try:
        scraped = scraper.extract_jobs(search_terms, locations)
        jobs_added = scraper.save_jobs(scraped)
    except Exception as e:
        errors.append(f"Wellfound Scraper Error: {str(e)}")

    return {"jobs_added": jobs_added, "errors": errors}


if __name__ == "__main__":
    config_str = sys.argv[1] if len(sys.argv) > 1 else "{}"
    payload = json.loads(config_str)
    
    if "db_url" not in payload:
        sys.stderr.write("Error: db_url not provided in JSON payload\\n")
        sys.exit(1)
        
    result = run(payload["db_url"], payload)
    print(json.dumps(result))
