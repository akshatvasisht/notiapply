from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List
from enum import Enum

class JobState(str, Enum):
    DISCOVERED = "discovered"
    FILTERED_OUT = "filtered-out"
    FILTERED = "filtered"
    DOCS_FAILED = "docs-failed"
    QUEUED = "queued"
    FILLING = "filling"
    FILL_FAILED = "fill-failed"
    REVIEW_INCOMPLETE = "review-incomplete"
    REVIEW_READY = "review-ready"
    SUBMITTED = "submitted"
    REJECTED = "rejected"
    TRACKING = "tracking"

class ContactState(str, Enum):
    IDENTIFIED = "identified"
    DRAFTED = "drafted"
    CONTACTED = "contacted"
    REPLIED = "replied"
    INTERVIEWING = "interviewing"
    REJECTED = "rejected"

class JobSource(str, Enum):
    LINKEDIN = "jobspy-linkedin"
    INDEED = "jobspy-indeed"
    GLASSDOOR = "jobspy-glassdoor"
    ZIPRECRUITER = "jobspy-ziprecruiter"
    GREENHOUSE = "ats-greenhouse"
    LEVER = "ats-lever"
    ASHBY = "ats-ashby"
    SIMPLIFY = "github-simplify"
    WELLFOUND = "wellfound"
    MANUAL = "manual"

class JobSchema(BaseModel):
    """Schema for a job posting extracted from a career page or job board."""
    title: str = Field(..., description="The job title (e.g., Senior Software Engineer)")
    company: str = Field(..., description="The name of the company hiring")
    location: str = Field(..., description="Location of the job (e.g., San Francisco, CA or Remote)")
    url: HttpUrl = Field(..., description="The direct URL to the job posting")
    description_raw: str = Field(..., description="The full, unformatted text of the job description")
    salary_min: Optional[int] = Field(None, description="Minimum annual salary if listed")
    salary_max: Optional[int] = Field(None, description="Maximum annual salary if listed")
    equity_min: Optional[float] = Field(None, description="Minimum equity percentage if listed")
    equity_max: Optional[float] = Field(None, description="Maximum equity percentage if listed")
    source: JobSource = Field(JobSource.LINKEDIN, description="The platform where the job was found")
    company_logo_url: Optional[HttpUrl] = Field(None, description="URL to the company logo image")

class ContactSchema(BaseModel):
    """Schema for a lead/contact identified for outreach."""
    name: str = Field(..., description="Full name of the person")
    role: Optional[str] = Field(None, description="Current role or title of the person")
    company_name: str = Field(..., description="Company where this person works")
    linkedin_url: Optional[HttpUrl] = Field(None, description="LinkedIn profile URL")
    email: Optional[str] = Field(None, description="Professional email address if found")
    notes: Optional[str] = Field(None, description="Brief context or reason why this person was identified")
    state: ContactState = Field(ContactState.IDENTIFIED, description="Current workflow state")
