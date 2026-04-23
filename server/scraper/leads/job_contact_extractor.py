"""
Job Posting Contact Extractor

Analyzes job descriptions to find embedded contact information:
- Recruiter emails
- Hiring manager names
- Department information
- LinkedIn profile links
"""

import re
import json
import sys
import os
import psycopg2
import structlog
from typing import List, Dict, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from base_scraper import BaseScraper

log = structlog.get_logger()


class JobContactExtractor(BaseScraper):
    def __init__(self, db_url: str):
        super().__init__(db_url, 'extract-job-contacts', use_stealth=False)

    def extract_jobs(self, *args, **kwargs):
        return []

    def extract_contacts_from_job(self, job: Dict) -> List[Dict]:
        """
        Extract potential contacts from job posting data.

        Args:
            job: Dict with keys: id, title, description, company_name, department

        Returns:
            List of contact dicts
        """
        contacts = []
        description = job.get('description', '')
        company_name = job.get('company_name', '')
        department = job.get('department') or self._infer_department(job.get('title', ''))

        # Extract recruiter emails
        emails = self._extract_emails(description)
        for email in emails:
            if self._is_recruiter_email(email):
                contacts.append({
                    'name': self._guess_name_from_email(email),
                    'role': 'Recruiter',
                    'company_name': company_name,
                    'email': email,
                    'linkedin_url': None,
                    'job_id': job['id'],
                    'source': 'job_description_email'
                })

        # Extract LinkedIn profile URLs
        linkedin_urls = self._extract_linkedin_urls(description)
        for url in linkedin_urls:
            contacts.append({
                'name': None,  # Will be enriched later
                'role': 'Hiring Contact',
                'company_name': company_name,
                'email': None,
                'linkedin_url': url,
                'job_id': job['id'],
                'source': 'job_description_linkedin'
            })

        # Extract hiring manager names from patterns like:
        # "You will report to Jane Doe, VP of Engineering"
        # "Join Sarah's team"
        # "Working with the hiring manager, John Smith"
        hiring_managers = self._extract_hiring_manager_names(description)
        for name, title in hiring_managers:
            contacts.append({
                'name': name,
                'role': title or f'{department} Hiring Manager' if department else 'Hiring Manager',
                'company_name': company_name,
                'email': None,
                'linkedin_url': None,
                'job_id': job['id'],
                'source': 'job_description_text'
            })

        return contacts

    def _extract_emails(self, text: str) -> List[str]:
        """Extract email addresses from text."""
        # Standard email regex
        pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(pattern, text)

        # Filter out common false positives
        filtered = []
        for email in emails:
            email_lower = email.lower()
            # Skip example emails
            if any(skip in email_lower for skip in ['example.com', 'test.com', 'domain.com']):
                continue
            filtered.append(email)

        return filtered

    def _is_recruiter_email(self, email: str) -> bool:
        """Check if email looks like a recruiter/hiring contact."""
        email_lower = email.lower()
        recruiter_keywords = [
            'recruit', 'hiring', 'talent', 'careers', 'hr',
            'jobs', 'people', 'staffing', 'employment'
        ]
        return any(keyword in email_lower for keyword in recruiter_keywords)

    def _guess_name_from_email(self, email: str) -> Optional[str]:
        """Attempt to derive name from email (e.g., jane.doe@company.com → Jane Doe)."""
        local_part = email.split('@')[0]

        # Common patterns: firstname.lastname, firstname_lastname, firstnamelastname
        if '.' in local_part:
            parts = local_part.split('.')
        elif '_' in local_part:
            parts = local_part.split('_')
        else:
            # If no separator and not a generic term, treat as first name
            if not self._is_generic_email(local_part):
                return local_part.capitalize()
            return None

        # Capitalize each part
        name_parts = [part.capitalize() for part in parts if len(part) > 1]

        if len(name_parts) >= 2:
            return ' '.join(name_parts)

        return None

    def _is_generic_email(self, local_part: str) -> bool:
        """Check if email local part is generic (hiring@, careers@, etc.)."""
        generic_terms = [
            'hiring', 'recruit', 'careers', 'jobs', 'hr', 'talent',
            'info', 'contact', 'hello', 'team', 'support'
        ]
        return local_part.lower() in generic_terms

    def _extract_linkedin_urls(self, text: str) -> List[str]:
        """Extract LinkedIn profile URLs."""
        pattern = r'https?://(?:www\.)?linkedin\.com/in/[\w-]+'
        urls = re.findall(pattern, text)
        return list(set(urls))  # Deduplicate

    def _extract_hiring_manager_names(self, text: str) -> List[tuple]:
        """
        Extract hiring manager names from common patterns.
        Returns: List of (name, title) tuples
        """
        managers = []

        # Pattern 1: "report to [Name], [Title]"
        pattern1 = r'report(?:ing)? to ([A-Z][a-z]+ [A-Z][a-z]+)(?:,\s*([^\.]+))?'
        matches = re.findall(pattern1, text)
        for name, title in matches:
            managers.append((name.strip(), title.strip() if title else None))

        # Pattern 2: "Join [Name]'s team"
        pattern2 = r"Join ([A-Z][a-z]+ [A-Z][a-z]+)'s team"
        matches = re.findall(pattern2, text)
        for name in matches:
            managers.append((name.strip(), None))

        # Pattern 3: "working with [Name], [Title]"
        pattern3 = r'working with ([A-Z][a-z]+ [A-Z][a-z]+)(?:,\s*([^\.]+))?'
        matches = re.findall(pattern3, text)
        for name, title in matches:
            managers.append((name.strip(), title.strip() if title else None))

        return managers

    def _infer_department(self, job_title: str) -> Optional[str]:
        """Infer department from job title."""
        title_lower = job_title.lower()

        if any(kw in title_lower for kw in ['engineer', 'developer', 'swe', 'software', 'backend', 'frontend', 'fullstack']):
            return 'Engineering'
        elif any(kw in title_lower for kw in ['data', 'analyst', 'scientist', 'ml', 'ai']):
            return 'Data/ML'
        elif any(kw in title_lower for kw in ['product', 'pm']):
            return 'Product'
        elif any(kw in title_lower for kw in ['design', 'ux', 'ui']):
            return 'Design'
        elif any(kw in title_lower for kw in ['sales', 'account', 'customer success']):
            return 'Sales'
        elif any(kw in title_lower for kw in ['marketing', 'growth']):
            return 'Marketing'

        return None


def run(db_url: str, module_config: dict):
    """
    Process all jobs without contacts and extract hiring contacts.
    """
    extractor = JobContactExtractor(db_url)
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    # Get jobs that don't have associated contacts yet
    cur.execute("""
        SELECT j.id, j.title, j.description_raw, j.company
        FROM jobs j
        LEFT JOIN contacts c ON c.job_id = j.id
        WHERE c.id IS NULL
        AND j.description_raw IS NOT NULL
        AND j.state IN ('discovered', 'filtered', 'queued')
        LIMIT 100
    """)

    jobs = cur.fetchall()
    contacts_added = 0
    errors = []

    log.info("batch_start", jobs_without_contacts=len(jobs))

    for job_id, title, description, company in jobs:
        try:
            job_data = {
                'id': job_id,
                'title': title,
                'description': description,
                'company_name': company,
            }

            contacts = extractor.extract_contacts_from_job(job_data)

            if contacts:
                log.info("contacts_found", job_id=job_id, company=company, count=len(contacts))
                contacts_added += extractor.save_contacts(contacts)

        except Exception as e:
            error_msg = f"Job {job_id}: {str(e)}"
            errors.append(error_msg)
            log.error("extraction_failed", job_id=job_id, error=error_msg)

    cur.close()
    conn.close()

    return {
        "contacts_added": contacts_added,
        "jobs_processed": len(jobs),
        "errors": errors
    }


if __name__ == "__main__":
    from scraper.db_connect import get_db_url

    config_str = sys.argv[1] if len(sys.argv) > 1 else "{}"
    payload = json.loads(config_str)

    result = run(get_db_url(payload), payload)
    print(json.dumps(result))
