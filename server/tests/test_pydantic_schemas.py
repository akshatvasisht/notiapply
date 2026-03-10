import sys
import os

# Add the parent directory to sys.path so we can import scraper
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scraper.schemas import JobSchema, ContactSchema, JobSource, ContactState
from pydantic import ValidationError

def test_job_schema_validation():
    print("Test: JobSchema valid data")
    valid_job = {
        "title": "Software Engineer",
        "company": "Tech Corp",
        "location": "San Francisco",
        "url": "https://example.com/job",
        "description_raw": "Job description here",
        "source": JobSource.LINKEDIN
    }
    JobSchema(**valid_job)
    print("PASS")

    print("Test: JobSchema invalid URL")
    invalid_job = valid_job.copy()
    invalid_job["url"] = "not-a-url"
    try:
        JobSchema(**invalid_job)
        assert False, "Should have raised ValidationError"
    except ValidationError:
        print("PASS")

    print("Test: JobSchema missing required field")
    missing_field = valid_job.copy()
    del missing_field["title"]
    try:
        JobSchema(**missing_field)
        assert False, "Should have raised ValidationError"
    except ValidationError:
        print("PASS")

def test_contact_schema_validation():
    print("Test: ContactSchema valid data")
    valid_contact = {
        "name": "Jane Smith",
        "company_name": "Example Inc",
        "state": ContactState.IDENTIFIED
    }
    ContactSchema(**valid_contact)
    print("PASS")

if __name__ == "__main__":
    try:
        test_job_schema_validation()
        test_contact_schema_validation()
        print("\nAll schema tests passed!")
    except Exception as e:
        print(f"\nTest Failed: {e}")
        sys.exit(1)
