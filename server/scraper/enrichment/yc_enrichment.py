"""
YC Company Enrichment
Uses free YC API to fetch company data for YC-backed companies.
"""

import requests
import psycopg2
from typing import Optional, Dict
import sys


def fetch_yc_company(company_name: str) -> Optional[Dict]:
    """
    Fetch company data from YC API.

    Args:
        company_name: Company name (e.g., "Stripe", "Airbnb")

    Returns:
        Company data dict or None if not found
    """
    # YC API uses slugified names
    slug = company_name.lower().replace(' ', '-').replace('.', '').replace(',', '')

    url = f'https://api.ycombinator.com/v0.1/companies/{slug}.json'

    try:
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            return {
                'funding_stage': data.get('batch'),  # e.g., "S20"
                'headcount_range': f"~{data.get('team_size', 0)}",
                'description': data.get('one_liner'),
                'website': data.get('website'),
                'is_hiring': data.get('isHiring', False),
            }
    except Exception as e:
        print(f"YC API error for {company_name}: {e}")

    return None


def enrich_contacts_from_yc(db_url: str):
    """
    Enrich all contacts with missing company data using YC API.
    """
    with psycopg2.connect(db_url) as conn:
        with conn.cursor() as cur:
            # Get contacts without company data
            cur.execute("""
                SELECT id, company_name
                FROM contacts
                WHERE company_industry IS NULL
                AND company_name IS NOT NULL
            """)

            contacts = cur.fetchall()
            enriched = 0

            print(f"Found {len(contacts)} contacts without company data")

            for contact_id, company_name in contacts:
                print(f"Checking {company_name}...", end=" ")
                yc_data = fetch_yc_company(company_name)

                if yc_data:
                    cur.execute("""
                        UPDATE contacts
                        SET company_industry = 'YC-backed',
                            company_headcount_range = %s,
                            company_funding_stage = %s,
                            company_notes = %s
                        WHERE id = %s
                    """, (
                        yc_data['headcount_range'],
                        yc_data['funding_stage'],
                        f"{yc_data['description']} | {yc_data['website']}",
                        contact_id
                    ))
                    enriched += 1
                    print(f"✓ Enriched ({yc_data['funding_stage']})")
                else:
                    print("✗ Not found in YC")

            conn.commit()
            print(f"\n✓ Enriched {enriched}/{len(contacts)} contacts from YC API")


if __name__ == '__main__':
    if len(sys.argv) > 1:
        db_url = sys.argv[1]
    else:
        db_url = input('Enter DATABASE_URL: ')

    enrich_contacts_from_yc(db_url)
