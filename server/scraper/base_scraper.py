import abc
import hashlib
import json
import psycopg2
import instructor
from openai import OpenAI
from typing import List, Dict, Any, Type, Optional
from scrapling import Fetcher
from pydantic import BaseModel

class BaseScraper(abc.ABC):
    """
    Base scraper class using Scrapling for resilient extraction and
    Instructor for structured LLM parsing.
    """
    def __init__(self, db_url: str, api_key: str = None, base_url: str = None, model: str = "gpt-4o-mini", use_stealth: bool = True):
        self.db_url = db_url
        self.use_stealth = use_stealth
        self.fetcher = Fetcher(stealth=self.use_stealth, auto_match=False if not use_stealth else True)
        
        # Instructor-patched LLM client
        if api_key:
            self.client = instructor.patch(OpenAI(api_key=api_key, base_url=base_url))
            self.model = model
        else:
            self.client = None
            self.model = None

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

    async def crawl_url(self, url: str) -> str:
        """Use crawl4ai to get clean markdown from a URL (Background task)."""
        from crawl4ai import AsyncWebCrawler
        async with AsyncWebCrawler(verbose=True) as crawler:
            result = await crawler.arun(url=url)
            return result.markdown

    @abc.abstractmethod
    def extract_jobs(self, *args, **kwargs) -> List[Dict[str, Any]]:
        pass

    def extract_contacts(self, *args, **kwargs) -> List[Dict[str, Any]]:
        return []

    def save_jobs(self, jobs: List[Dict[str, Any]]) -> int:
        jobs_added = 0
        conn = self.get_connection()
        cur = conn.cursor()
        try:
            for job in jobs:
                h = self.dedup_hash(job["company"], job["title"], job["location"])
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
            conn.rollback()
            raise e
        finally:
            cur.close()
            conn.close()
        return jobs_added

    def save_contacts(self, contacts: List[Dict[str, Any]]) -> int:
        contacts_added = 0
        conn = self.get_connection()
        cur = conn.cursor()
        try:
            for contact in contacts:
                h = self.contact_hash(contact["name"], contact["company_name"])
                cur.execute("""
                    INSERT INTO contacts (name, role, company_name, linkedin_url, email, contact_hash)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (contact_hash) DO NOTHING
                """, (
                    contact["name"], contact.get("role"), contact["company_name"], 
                    contact.get("linkedin_url"), contact.get("email"), h
                ))
                if cur.rowcount > 0:
                    contacts_added += 1
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cur.close()
            conn.close()
        return contacts_added
