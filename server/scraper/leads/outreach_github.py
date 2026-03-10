"""Tier 5 scraper: GitHub Org leads extractor.

Hits GitHub's Public API to extract members of target orgs,
and pulls their public emails and names for outreach.
"""

import json
import sys
import os
import psycopg2

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_scraper import BaseScraper


class GithubOutreachScraper(BaseScraper):
    def __init__(self, db_url: str):
        super().__init__(db_url, use_stealth=False)
        self.headers = {"Accept": "application/vnd.github.v3+json"}

    def extract_contacts(self, org_names: list) -> list:
        contacts = []
        for org in org_names:
            members_url = f"https://api.github.com/orgs/{org}/members"
            try:
                resp = self.fetcher.get(members_url)
                try:
                    members = resp.json()
                except json.JSONDecodeError:
                    continue
                
                if not isinstance(members, list):
                    continue

                for member in members:
                    username = member.get("login")
                    if not username:
                        continue
                    
                    user_url = f"https://api.github.com/users/{username}"
                    user_resp = self.fetcher.get(user_url)
                    try:
                        user_data = user_resp.json()
                    except json.JSONDecodeError:
                        continue
                        
                    name = user_data.get("name")
                    if not name:
                        name = username
                        
                    contacts.append({
                        "name": name,
                        "role": "Engineer",
                        "company_name": org,
                        "linkedin_url": user_data.get("blog"),
                        "email": user_data.get("email")
                    })
            except Exception:
                continue

        return contacts


def run(db_url: str, module_config: dict):
    scraper = GithubOutreachScraper(db_url)
    errors = []
    contacts_added = 0
    
    orgs = module_config.get("github_orgs", [])
    
    try:
        scraped = scraper.extract_contacts(orgs)
        contacts_added = scraper.save_contacts(scraped)
    except Exception as e:
        errors.append(f"GitHub Scraper Error: {str(e)}")

    return {"contacts_added": contacts_added, "errors": errors}


if __name__ == "__main__":
    config_str = sys.argv[1] if len(sys.argv) > 1 else "{}"
    payload = json.loads(config_str)
    
    if "db_url" not in payload:
        sys.stderr.write("Error: db_url not provided in JSON payload\\n")
        sys.exit(1)
        
    result = run(payload["db_url"], payload)
    print(json.dumps(result))
