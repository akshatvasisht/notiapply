import abc
import hashlib
import json
import psycopg2
from psycopg2 import extras as psycopg2_extras
import instructor
from openai import OpenAI
from typing import List, Dict, Any, Type, Optional
from pydantic import BaseModel
from datetime import datetime
from .job_relevance import should_auto_filter
from .log_config import configure_logging
import structlog
import subprocess
import time
import random

# NOTE: scrapling.Fetcher is lazy-imported inside BaseScraper.__init__ to keep
# this module (and its downstream importers like test_base_scraper.py) loadable
# in test environments without playwright — scrapling transitively imports
# playwright._impl._errors, which isn't installed in lightweight venvs.
# The Docker runner image has the full dep chain; production is unaffected.

configure_logging()

class BaseScraper(abc.ABC):
    """
    Base scraper class using Scrapling for resilient extraction and
    Instructor for structured LLM parsing with run tracking.
    """
    def __init__(self, db_url: str, scraper_key: str, api_key: str = None, base_url: str = None, model: str = "gpt-4o-mini", use_stealth: bool = True, user_criteria: Optional[Dict] = None, enable_relevance_filter: bool = False, min_delay: float = 2.0, max_delay: float = 5.0):
        self.db_url = db_url
        self.scraper_key = scraper_key
        self.log = structlog.get_logger().bind(scraper_key=self.scraper_key)
        self.use_stealth = use_stealth
        from scrapling import Fetcher  # lazy: see module docstring
        self.fetcher = Fetcher(stealth=self.use_stealth, auto_match=False if not use_stealth else True)
        self.run_id: Optional[int] = None
        self.errors: List[str] = []
        self.enable_relevance_filter = enable_relevance_filter
        self.relevance_scorer = None
        # Rate limiting to mimic human behavior and avoid detection
        self.min_delay = min_delay
        self.max_delay = max_delay

        # Instructor-patched LLM client
        if api_key:
            self.client = instructor.patch(OpenAI(api_key=api_key, base_url=base_url))
            self.model = model
        else:
            self.client = None
            self.model = None

        # Optional relevance filtering
        if enable_relevance_filter and api_key and user_criteria:
            from .job_relevance import JobRelevanceScorer
            self.relevance_scorer = JobRelevanceScorer(
                api_key=api_key,
                base_url=base_url,
                model=model,
                user_criteria=user_criteria
            )

    def _respectful_delay(self):
        """
        Add random delay between requests to mimic human browsing behavior.
        This helps avoid detection and respects server resources.
        """
        delay = random.uniform(self.min_delay, self.max_delay)
        time.sleep(delay)

    def fetch_with_retry(self, url: str, max_retries: int = 3):
        """Fetch URL with exponential backoff on failure or 429."""
        for attempt in range(max_retries):
            self._respectful_delay()
            try:
                resp = self.fetcher.get(url)
                if hasattr(resp, 'status_code') and resp.status_code == 429:
                    wait = (2 ** attempt) * random.uniform(0.8, 1.2)
                    self.log.warning("rate_limited", url=url, retry_in=round(wait, 1))
                    time.sleep(wait)
                    continue
                return resp
            except Exception:
                if attempt == max_retries - 1:
                    raise
                wait = (2 ** attempt) * random.uniform(0.8, 1.2)
                self.log.warning("fetch_retry", url=url, attempt=attempt + 1, retry_in=round(wait, 1))
                time.sleep(wait)
        return resp

    @staticmethod
    def dedup_hash(company: str, title: str, location: str) -> str:
        raw = f"{company.lower()}|{title.lower()}|{location.lower()}"
        return hashlib.sha256(raw.encode()).hexdigest()

    @staticmethod
    def contact_hash(name: str, company: str) -> str:
        raw = f"{name.lower()}|{company.lower()}"
        return hashlib.sha256(raw.encode()).hexdigest()

    def get_connection(self):
        return psycopg2.connect(self.db_url)

    def get_version(self) -> str:
        """Get git commit hash for tracking code versions"""
        try:
            result = subprocess.run(
                ['git', 'rev-parse', '--short', 'HEAD'],
                capture_output=True,
                text=True,
                timeout=2
            )
            return result.stdout.strip() if result.returncode == 0 else 'unknown'
        except (subprocess.SubprocessError, subprocess.TimeoutExpired, OSError, FileNotFoundError):
            return 'unknown'

    def start_run(self):
        """Log scraper run start"""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO scraper_runs (scraper_key, status, version)
                    VALUES (%s, 'running', %s)
                    RETURNING id
                """, (self.scraper_key, self.get_version()))
                self.run_id = cur.fetchone()[0]
                conn.commit()

    def complete_run(self, jobs_found: int, status: str = 'success'):
        """Log scraper run completion"""
        if self.run_id is None:
            return

        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE scraper_runs
                    SET completed_at = NOW(),
                        jobs_found = %s,
                        errors = %s,
                        status = %s
                    WHERE id = %s
                """, (jobs_found, self.errors if self.errors else None, status, self.run_id))
                conn.commit()

    def log_error(self, error: str):
        """Add error to run log"""
        self.errors.append(f"{datetime.now().isoformat()}: {error}")

    def extract_structured(self, text: str, response_model: Type[BaseModel], system_prompt: str = "Extract information from the following text.") -> BaseModel:
        """Use Instructor to extract structured data from raw text."""
        if not self.client:
            raise ValueError("LLM client not initialized. Provide api_key during __init__.")
            
        return self.client.chat.completions.create(
            model=self.model,
            response_model=response_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
        )

    @abc.abstractmethod
    def extract_jobs(self, *args, **kwargs) -> List[Dict[str, Any]]:
        pass

    def extract_contacts(self, *args, **kwargs) -> List[Dict[str, Any]]:
        return []

    def save_jobs(self, jobs: List[Dict[str, Any]], max_batch_size: int = 200) -> int:
        jobs_added = 0
        if len(jobs) > max_batch_size:
            self.log_error(f"Batch truncated: {len(jobs)} jobs received, capping at {max_batch_size}")
            jobs = jobs[:max_batch_size]
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                try:
                    rows = []
                    for job in jobs:
                        h = self.dedup_hash(job["company"], job["title"], job["location"])

                        initial_state = 'discovered'
                        relevance_score = None
                        score_breakdown = None
                        if self.relevance_scorer:
                            try:
                                score = self.relevance_scorer.score_job(
                                    title=job["title"],
                                    description=job["description_raw"],
                                    company=job["company"]
                                )
                                relevance_score = score.overall_score
                                score_breakdown = json.dumps({
                                    "reasons": score.reasons,
                                    "red_flags": score.red_flags,
                                    "match_highlights": score.match_highlights,
                                })
                                if should_auto_filter(score):
                                    initial_state = 'filtered-out'
                                    self.log_error(f"Auto-filtered: {job['title']} (score: {score.overall_score}, red_flags: {score.red_flags})")
                            except Exception as e:
                                self.log_error(f"Relevance scoring failed for {job['title']}: {str(e)}")

                        rows.append((
                            job["source"], job["title"], job["company"], job["location"],
                            job["url"], job["description_raw"],
                            job.get("salary_min"), job.get("salary_max"),
                            job.get("equity_min"), job.get("equity_max"),
                            h, initial_state, relevance_score, score_breakdown
                        ))

                    if rows:
                        psycopg2_extras.execute_values(cur, """
                            INSERT INTO jobs (source, title, company, location, url,
                                             description_raw, salary_min, salary_max,
                                             equity_min, equity_max,
                                             company_role_location_hash, state,
                                             relevance_score, score_breakdown)
                            VALUES %s
                            ON CONFLICT (company_role_location_hash) DO NOTHING
                        """, rows)
                        jobs_added = cur.rowcount
                    conn.commit()
                except Exception as e:
                    conn.rollback()
                    raise e
        return jobs_added

    def save_contacts(self, contacts: List[Dict[str, Any]]) -> int:
        contacts_added = 0
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                try:
                    for contact in contacts:
                        h = self.contact_hash(contact["name"], contact["company_name"])
                        cur.execute("""
                            INSERT INTO contacts (name, role, company_name, linkedin_url, personal_url, email, contact_hash, job_id, department, source)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (contact_hash) DO NOTHING
                        """, (
                            contact["name"], contact.get("role"), contact["company_name"],
                            contact.get("linkedin_url"), contact.get("personal_url"),
                            contact.get("email"), h,
                            contact.get("job_id"), contact.get("department"), contact.get("source")
                        ))
                        if cur.rowcount > 0:
                            contacts_added += 1
                    conn.commit()
                except Exception as e:
                    conn.rollback()
                    raise e
        return contacts_added
