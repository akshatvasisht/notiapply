"""Tier 5 scraper: YC Work at a Startup leads extractor.

Uses Scrapling's text-based search to identify founders
without relying on brittle structural CSS selectors.
"""

import json
import sys
import os
import psycopg2

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_scraper import BaseScraper


class YCOutreachScraper(BaseScraper):
    def __init__(self, db_url: str, api_key: str = None, base_url: str = None, model: str = "gpt-4o-mini"):
        super().__init__(db_url, 'scrape-outreach-yc', api_key=api_key, base_url=base_url, model=model, use_stealth=True)

    def extract_jobs(self, *args, **kwargs):
        return []

    def extract_contacts(self, company_slugs: list) -> list:
        contacts = []
        for slug in company_slugs:
            url = f"https://www.ycombinator.com/companies/{slug}"
            try:
                resp = self.fetcher.get(url)
                h1_elements = resp.css('h1')
                if not h1_elements:
                    continue
                company_name = h1_elements[0].text
                
                founder_containers = resp.css('div').filter(
                    lambda el: "Founder" in el.text and len(el.text) < 200
                )
                
                seen_names = set()
                
                for el in founder_containers:
                    name_els = el.css('h3')
                    if not name_els:
                        continue
                        
                    name = name_els[0].text
                    if name in seen_names:
                        continue
                    seen_names.add(name)
                    
                    role_els = el.css('p')
                    role = role_els[0].text if role_els else "Founder"
                    
                    linkedin_els = el.css('a[href*="linkedin.com"]')
                    linkedin_url = linkedin_els[0].attrib.get('href') if linkedin_els else None
                    
                    contacts.append({
                        "name": name,
                        "role": role,
                        "company_name": company_name,
                        "linkedin_url": linkedin_url,
                        "email": None
                    })
            except Exception:
                continue

        return contacts


def run(db_url: str, module_config: dict):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    slugs = module_config.get("yc_slugs", [])
    cur.close()
    conn.close()

    scraper = YCOutreachScraper(
        db_url, 
        api_key=module_config.get("llm_api_key"),
        base_url=module_config.get("llm_endpoint"),
        model=module_config.get("llm_model", "gpt-4o-mini")
    )
    errors = []
    contacts_added = 0
    
    try:
        scraped = scraper.extract_contacts(slugs)
        contacts_added = scraper.save_contacts(scraped)
    except Exception as e:
        errors.append(f"YC Scraper Error: {str(e)}")

    return {"contacts_added": contacts_added, "errors": errors}


if __name__ == "__main__":
    from scraper.db_connect import get_db_url

    config_str = sys.argv[1] if len(sys.argv) > 1 else "{}"
    payload = json.loads(config_str)

    result = run(get_db_url(payload), payload)
    print(json.dumps(result))
