"""
Test suite for liveness_check module — ghost job / stale posting detection.
"""
import sys
import os
import urllib.error

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from unittest.mock import patch, MagicMock, call

from scraper.liveness_check import (
    _redirect_looks_dead,
    check_url,
    main,
    DEAD_PHRASES,
    ACTIVE_STATES,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_mock_response(status, body=b'', location=None):
    """Build a fake urllib response object."""
    resp = MagicMock()
    resp.status = status
    resp.headers.get.side_effect = lambda k, default=None: location if k == 'Location' else default
    resp.read.return_value = body
    return resp


def make_mock_opener(head_response, get_response=None):
    """Return a mock opener whose .open() returns head_response.

    If get_response is provided the second call to open() returns it
    (simulating the body-fetch GET after a 200 HEAD).
    """
    opener = MagicMock()
    if get_response is not None:
        opener.open.return_value.__enter__.side_effect = [head_response, get_response]
    else:
        opener.open.return_value.__enter__.return_value = head_response
    return opener


# ---------------------------------------------------------------------------
# Tests for _redirect_looks_dead  (pure function — no mocking required)
# ---------------------------------------------------------------------------

class TestRedirectLooksDead:
    """Unit tests for the _redirect_looks_dead heuristic."""

    def test_company_slug_in_redirect_returns_false(self):
        """If the company slug appears in the redirect URL the job is still live."""
        result = _redirect_looks_dead(
            'https://jobs.acmecorp.com/job/123',
            'https://acmecorp.com/careers/123',
            'Acme Corp',
        )
        assert result is False

    def test_original_path_component_survives_in_redirect_returns_false(self):
        """A meaningful path segment from the original URL that survives → live."""
        result = _redirect_looks_dead(
            'https://example.com/job/engineer-fullstack',
            'https://example.com/en/job/engineer-fullstack',
            'Unknown Company',
        )
        assert result is False

    def test_redirect_to_root_returns_true(self):
        """Redirect to root '/' → dead."""
        result = _redirect_looks_dead(
            'https://example.com/jobs/123',
            'https://example.com/',
            'SomeCo',
        )
        assert result is True

    def test_redirect_to_jobs_page_returns_true(self):
        """Redirect to '/jobs' → dead."""
        result = _redirect_looks_dead(
            'https://example.com/job/456',
            'https://example.com/jobs',
            'SomeCo',
        )
        assert result is True

    def test_redirect_to_careers_page_returns_true(self):
        """Redirect to '/careers' → dead."""
        result = _redirect_looks_dead(
            'https://example.com/job/789',
            'https://example.com/careers',
            'SomeCo',
        )
        assert result is True

    def test_completely_unrelated_redirect_returns_true(self):
        """Redirect to a totally different path with no matching components → dead."""
        result = _redirect_looks_dead(
            'https://jobs.example.com/posting/software-engineer-123456',
            'https://example.com/signin?next=%2F',
            'SomeCo',
        )
        assert result is True


# ---------------------------------------------------------------------------
# Tests for check_url
# ---------------------------------------------------------------------------

class TestCheckUrl:
    """Tests for the check_url(url, company) function."""

    def _run(self, head_resp, get_resp=None):
        """Helper: patch _make_opener and call check_url."""
        opener = MagicMock()
        if get_resp is not None:
            # First open() → head_resp context, second → get_resp context
            cm_head = MagicMock()
            cm_head.__enter__ = MagicMock(return_value=head_resp)
            cm_head.__exit__ = MagicMock(return_value=False)
            cm_get = MagicMock()
            cm_get.__enter__ = MagicMock(return_value=get_resp)
            cm_get.__exit__ = MagicMock(return_value=False)
            opener.open.side_effect = [cm_head, cm_get]
        else:
            cm = MagicMock()
            cm.__enter__ = MagicMock(return_value=head_resp)
            cm.__exit__ = MagicMock(return_value=False)
            opener.open.return_value = cm

        with patch('scraper.liveness_check._make_opener', return_value=opener):
            return check_url('https://example.com/job/1', 'TestCo')

    def test_404_response_is_dead(self):
        """HTTP 404 → (True, message containing '404')."""
        resp = make_mock_response(404)
        is_dead, reason = self._run(resp)
        assert is_dead is True
        assert '404' in reason

    def test_410_response_is_dead(self):
        """HTTP 410 → (True, message containing '410')."""
        resp = make_mock_response(410)
        is_dead, reason = self._run(resp)
        assert is_dead is True
        assert '410' in reason

    def test_301_with_dead_redirect_is_dead(self):
        """301 redirect to a generic listing page → (True, reason mentions 'redirect')."""
        resp = make_mock_response(301, location='https://example.com/jobs')
        is_dead, reason = self._run(resp)
        assert is_dead is True
        assert 'redirect' in reason.lower()

    def test_301_with_live_redirect_is_not_dead(self):
        """301 redirect containing the company slug → (False, reason mentions 'redirect')."""
        resp = make_mock_response(
            301,
            location='https://testco.com/careers/engineer',
        )
        with patch('scraper.liveness_check._make_opener') as mock_opener_factory:
            opener = MagicMock()
            cm = MagicMock()
            cm.__enter__ = MagicMock(return_value=resp)
            cm.__exit__ = MagicMock(return_value=False)
            opener.open.return_value = cm
            mock_opener_factory.return_value = opener

            is_dead, reason = check_url('https://testco.com/job/1', 'TestCo')

        assert is_dead is False
        assert 'redirect' in reason.lower()

    def test_200_with_dead_phrase_in_body_is_dead(self):
        """200 response whose body contains a DEAD_PHRASE → (True, 'body contains ...')."""
        dead_phrase = DEAD_PHRASES[0]
        head_resp = make_mock_response(200)
        body_resp = make_mock_response(200, body=dead_phrase.encode('utf-8'))
        body_resp.read.return_value = dead_phrase.encode('utf-8')

        is_dead, reason = self._run(head_resp, get_resp=body_resp)
        assert is_dead is True
        assert 'body contains' in reason

    def test_200_with_clean_body_is_live(self):
        """200 response with innocuous body → (False, '200 OK')."""
        head_resp = make_mock_response(200)
        body_resp = make_mock_response(200, body=b'Apply now for this great role!')
        body_resp.read.return_value = b'Apply now for this great role!'

        is_dead, reason = self._run(head_resp, get_resp=body_resp)
        assert is_dead is False
        assert reason == '200 OK'

    def test_http_error_404_is_dead(self):
        """urllib HTTPError with code 404 → (True, ...)."""
        url = 'https://example.com/job/1'
        err = urllib.error.HTTPError(url, 404, 'Not Found', {}, None)

        with patch('scraper.liveness_check._make_opener') as mock_opener_factory:
            opener = MagicMock()
            opener.open.side_effect = err
            mock_opener_factory.return_value = opener

            is_dead, reason = check_url(url, 'TestCo')

        assert is_dead is True
        assert '404' in reason

    def test_generic_exception_returns_none(self):
        """A generic network exception → (None, str(exception))."""
        with patch('scraper.liveness_check._make_opener') as mock_opener_factory:
            opener = MagicMock()
            opener.open.side_effect = Exception('timeout')
            mock_opener_factory.return_value = opener

            is_dead, reason = check_url('https://example.com/job/1', 'TestCo')

        assert is_dead is None
        assert 'timeout' in reason


# ---------------------------------------------------------------------------
# Tests for main()
# ---------------------------------------------------------------------------

class TestMain:
    """Integration-style tests for the main() entry point."""

    def _make_db_mocks(self, mock_connect, rows):
        """Wire up psycopg2 mock to return the given rows from fetchall."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = rows
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn
        return mock_conn, mock_cursor

    @patch('scraper.liveness_check.time.sleep')
    @patch('scraper.liveness_check.check_url')
    @patch('psycopg2.connect')
    def test_dead_job_is_marked_filtered_out(self, mock_connect, mock_check_url, mock_sleep):
        """When check_url returns (True, ...) the job UPDATE sets is_live=false and state='filtered-out'."""
        rows = [(1, 'https://example.com/job/1', 'Acme')]
        mock_conn, mock_cursor = self._make_db_mocks(mock_connect, rows)
        mock_check_url.return_value = (True, 'HTTP 404')

        with patch('sys.argv', ['liveness_check.py', '{"db_url": "postgresql://test"}']):
            main()

        # Find the UPDATE call (second execute call — first is the SELECT)
        execute_calls = mock_cursor.execute.call_args_list
        update_calls = [c for c in execute_calls if 'UPDATE' in c[0][0]]
        assert len(update_calls) == 1
        update_sql = update_calls[0][0][0]
        assert 'is_live = false' in update_sql
        assert "filtered-out" in update_sql

    @patch('scraper.liveness_check.time.sleep')
    @patch('scraper.liveness_check.check_url')
    @patch('psycopg2.connect')
    def test_live_job_updates_only_liveness_checked_at(self, mock_connect, mock_check_url, mock_sleep):
        """When check_url returns (False, ...) only liveness_checked_at is touched — state unchanged."""
        rows = [(2, 'https://example.com/job/2', 'Acme')]
        mock_conn, mock_cursor = self._make_db_mocks(mock_connect, rows)
        mock_check_url.return_value = (False, '200 OK')

        with patch('sys.argv', ['liveness_check.py', '{"db_url": "postgresql://test"}']):
            main()

        execute_calls = mock_cursor.execute.call_args_list
        update_calls = [c for c in execute_calls if 'UPDATE' in c[0][0]]
        assert len(update_calls) == 1
        update_sql = update_calls[0][0][0]
        assert 'liveness_checked_at' in update_sql
        # Must NOT change state or is_live
        assert 'is_live' not in update_sql
        assert 'filtered-out' not in update_sql

    @patch('scraper.liveness_check.time.sleep')
    @patch('scraper.liveness_check.check_url')
    @patch('psycopg2.connect')
    def test_error_result_skips_update(self, mock_connect, mock_check_url, mock_sleep):
        """When check_url returns (None, ...) no UPDATE should be issued for that job."""
        rows = [(3, 'https://example.com/job/3', 'Acme')]
        mock_conn, mock_cursor = self._make_db_mocks(mock_connect, rows)
        mock_check_url.return_value = (None, 'timeout')

        with patch('sys.argv', ['liveness_check.py', '{"db_url": "postgresql://test"}']):
            main()

        execute_calls = mock_cursor.execute.call_args_list
        update_calls = [c for c in execute_calls if 'UPDATE' in c[0][0]]
        assert len(update_calls) == 0

    @patch('scraper.liveness_check.time.sleep')
    @patch('scraper.liveness_check.check_url')
    @patch('psycopg2.connect')
    def test_sleep_called_between_jobs(self, mock_connect, mock_check_url, mock_sleep):
        """time.sleep(0.5) must be called once per job."""
        rows = [
            (1, 'https://example.com/job/1', 'Acme'),
            (2, 'https://example.com/job/2', 'Acme'),
        ]
        mock_conn, mock_cursor = self._make_db_mocks(mock_connect, rows)
        mock_check_url.return_value = (False, '200 OK')

        with patch('sys.argv', ['liveness_check.py', '{"db_url": "postgresql://test"}']):
            main()

        assert mock_sleep.call_count == 2
        mock_sleep.assert_called_with(0.5)
