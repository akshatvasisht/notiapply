"""
Test suite for BaseScraper class covering core functionality
"""
import sys
import os
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scraper.base_scraper import BaseScraper
from pydantic import BaseModel


class MockScraper(BaseScraper):
    """Concrete implementation of BaseScraper for testing"""

    def scrape(self):
        pass


class TestModel(BaseModel):
    """Test Pydantic model for structured extraction"""

    title: str
    company: str


class TestBaseScraper:
    """Test suite for BaseScraper core methods"""

    @pytest.fixture
    def scraper(self):
        """Create a mock scraper instance"""
        with patch('scraper.base_scraper.Fetcher'):
            return MockScraper(
                db_url="postgresql://localhost/test",
                scraper_key="test-scraper",
                api_key="test-key",
                base_url="https://api.test.com",
                model="gpt-4o-mini",
                use_stealth=False,
                min_delay=0.1,
                max_delay=0.2,
            )

    def test_initialization(self, scraper):
        """Test scraper initialization with correct parameters"""
        assert scraper.db_url == "postgresql://localhost/test"
        assert scraper.scraper_key == "test-scraper"
        assert scraper.model == "gpt-4o-mini"
        assert scraper.use_stealth is False
        assert scraper.min_delay == 0.1
        assert scraper.max_delay == 0.2
        assert scraper.run_id is None
        assert scraper.errors == []

    def test_initialization_without_api_key(self):
        """Test scraper initialization without API key"""
        with patch('scraper.base_scraper.Fetcher'):
            scraper = MockScraper(
                db_url="postgresql://localhost/test", scraper_key="test", api_key=None
            )
            assert scraper.client is None
            assert scraper.model is None

    def test_dedup_hash(self):
        """Test job deduplication hash generation"""
        hash1 = BaseScraper.dedup_hash("TechCorp", "Software Engineer", "San Francisco")
        hash2 = BaseScraper.dedup_hash("TechCorp", "Software Engineer", "San Francisco")
        hash3 = BaseScraper.dedup_hash("TechCorp", "Data Scientist", "San Francisco")

        # Same input produces same hash
        assert hash1 == hash2
        # Different job produces different hash
        assert hash1 != hash3
        # Case-insensitive
        hash4 = BaseScraper.dedup_hash("TECHCORP", "SOFTWARE ENGINEER", "SAN FRANCISCO")
        assert hash1 == hash4

    def test_contact_hash(self):
        """Test contact deduplication hash generation"""
        hash1 = BaseScraper.contact_hash("Jane Doe", "TechCorp")
        hash2 = BaseScraper.contact_hash("Jane Doe", "TechCorp")
        hash3 = BaseScraper.contact_hash("John Doe", "TechCorp")

        assert hash1 == hash2
        assert hash1 != hash3
        # Case-insensitive
        hash4 = BaseScraper.contact_hash("JANE DOE", "TECHCORP")
        assert hash1 == hash4

    def test_get_version_success(self, scraper):
        """Test git version retrieval when git is available"""
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout="abc1234\n")
            version = scraper.get_version()
            assert version == "abc1234"
            mock_run.assert_called_once()

    def test_get_version_no_git(self, scraper):
        """Test git version retrieval when git is not available"""
        with patch('subprocess.run', side_effect=FileNotFoundError):
            version = scraper.get_version()
            assert version == "unknown"

    def test_get_version_timeout(self, scraper):
        """Test git version retrieval with timeout"""
        with patch('subprocess.run', side_effect=subprocess.TimeoutExpired('git', 2)):
            version = scraper.get_version()
            assert version == "unknown"

    def test_get_version_error(self, scraper):
        """Test git version retrieval when git command fails"""
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=1, stdout="")
            version = scraper.get_version()
            assert version == "unknown"

    def test_log_error(self, scraper):
        """Test error logging functionality"""
        assert len(scraper.errors) == 0

        scraper.log_error("Test error 1")
        assert len(scraper.errors) == 1
        assert "Test error 1" in scraper.errors[0]
        assert datetime.now().isoformat()[:10] in scraper.errors[0]  # Check date prefix

        scraper.log_error("Test error 2")
        assert len(scraper.errors) == 2

    @patch('psycopg2.connect')
    def test_start_run(self, mock_connect, scraper):
        """Test scraper run initialization"""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = (42,)
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_connect.return_value.__enter__.return_value = mock_conn

        scraper.start_run()

        assert scraper.run_id == 42
        mock_cursor.execute.assert_called_once()
        sql = mock_cursor.execute.call_args[0][0]
        assert "INSERT INTO scraper_runs" in sql
        assert "scraper_key" in sql

    @patch('psycopg2.connect')
    def test_complete_run_success(self, mock_connect, scraper):
        """Test successful scraper run completion"""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_connect.return_value.__enter__.return_value = mock_conn

        scraper.run_id = 42
        scraper.complete_run(jobs_found=10, status='success')

        mock_cursor.execute.assert_called_once()
        sql, params = mock_cursor.execute.call_args[0]
        assert "UPDATE scraper_runs" in sql
        assert params == (10, None, 'success', 42)

    @patch('psycopg2.connect')
    def test_complete_run_with_errors(self, mock_connect, scraper):
        """Test scraper run completion with errors"""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_connect.return_value.__enter__.return_value = mock_conn

        scraper.run_id = 42
        scraper.log_error("Error 1")
        scraper.log_error("Error 2")
        scraper.complete_run(jobs_found=5, status='partial')

        sql, params = mock_cursor.execute.call_args[0]
        assert params[0] == 5  # jobs_found
        assert len(params[1]) == 2  # errors list
        assert params[2] == 'partial'  # status

    @patch('psycopg2.connect')
    def test_complete_run_without_start(self, mock_connect, scraper):
        """Test complete_run does nothing if run_id is None"""
        scraper.complete_run(jobs_found=10)
        mock_connect.assert_not_called()

    def test_respectful_delay(self, scraper):
        """Test rate limiting delay"""
        import time

        start = time.time()
        scraper._respectful_delay()
        elapsed = time.time() - start

        # Should delay between min_delay and max_delay
        assert scraper.min_delay <= elapsed <= scraper.max_delay + 0.05  # Small tolerance

    def test_respectful_delay_random(self, scraper):
        """Test rate limiting produces different delays"""
        delays = []
        for _ in range(5):
            import time

            start = time.time()
            scraper._respectful_delay()
            delays.append(time.time() - start)

        # Not all delays should be identical (randomness check)
        assert len(set(delays)) > 1

    @patch('scraper.base_scraper.instructor')
    def test_extract_structured_success(self, mock_instructor, scraper):
        """Test structured data extraction with LLM"""
        mock_response = TestModel(title="Software Engineer", company="TechCorp")
        scraper.client = MagicMock()
        scraper.client.chat.completions.create.return_value = mock_response

        result = scraper.extract_structured(
            text="TechCorp is hiring a Software Engineer",
            response_model=TestModel,
            system_prompt="Extract job info",
        )

        assert isinstance(result, TestModel)
        assert result.title == "Software Engineer"
        assert result.company == "TechCorp"

    def test_extract_structured_no_client(self, scraper):
        """Test structured extraction fails gracefully without API key"""
        scraper.client = None

        with pytest.raises(ValueError, match="Instructor client not initialized"):
            scraper.extract_structured(
                text="Test text", response_model=TestModel, system_prompt="Extract"
            )

    @patch('scraper.base_scraper.JobRelevanceScorer')
    def test_initialization_with_relevance_filter(self, mock_scorer):
        """Test scraper initialization with relevance filtering enabled"""
        with patch('scraper.base_scraper.Fetcher'):
            user_criteria = {
                "target_roles": ["Software Engineer"],
                "required_skills": ["Python"],
                "min_experience_years": 3,
            }

            scraper = MockScraper(
                db_url="postgresql://localhost/test",
                scraper_key="test",
                api_key="test-key",
                enable_relevance_filter=True,
                user_criteria=user_criteria,
            )

            assert scraper.enable_relevance_filter is True
            assert scraper.relevance_scorer is not None
            mock_scorer.assert_called_once()

    def test_hash_consistency_across_platforms(self):
        """Test that hashes are deterministic across different runs"""
        # Run hash multiple times
        hashes = [
            BaseScraper.dedup_hash("Company", "Title", "Location") for _ in range(10)
        ]

        # All should be identical
        assert len(set(hashes)) == 1

    def test_hash_length(self):
        """Test that hash outputs are consistent length (SHA256 = 64 hex chars)"""
        job_hash = BaseScraper.dedup_hash("Company", "Title", "Location")
        contact_hash = BaseScraper.contact_hash("Name", "Company")

        assert len(job_hash) == 64
        assert len(contact_hash) == 64
        assert all(c in '0123456789abcdef' for c in job_hash)
        assert all(c in '0123456789abcdef' for c in contact_hash)
