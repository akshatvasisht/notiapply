"""Tests for the enrich_contacts runner module.

Covers the SSRF guard, LLM-response parsing (including code-fence recovery),
the pending-then-failed/completed state machine, and partial-batch tolerance.
"""
from __future__ import annotations

import json
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scraper.enrich_contacts import (  # noqa: E402
    ENRICHMENT_SCHEMA_VERSION,
    _parse_enrichment,
    _url_is_safe,
    run,
)


# ─── SSRF guard ──────────────────────────────────────────────────────────────


class TestUrlIsSafe:
    def test_public_https_ok(self):
        ok, _ = _url_is_safe("https://example.com/about")
        assert ok is True

    def test_http_scheme_rejected_non_public(self):
        ok, reason = _url_is_safe("http://localhost/secret")
        assert ok is False
        assert "host" in reason.lower()

    def test_file_scheme_rejected(self):
        ok, reason = _url_is_safe("file:///etc/passwd")
        assert ok is False
        assert "scheme" in reason

    def test_rfc1918_rejected(self):
        # This will only reject reliably if the getaddrinfo mock returns a private address.
        with patch("scraper.enrich_contacts.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("10.0.0.5", 0))]
            ok, reason = _url_is_safe("https://internal.example/")
        assert ok is False
        assert "non-public" in reason

    def test_metadata_endpoint_rejected(self):
        with patch("scraper.enrich_contacts.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("169.254.169.254", 0))]
            ok, reason = _url_is_safe("https://metadata.internal/")
        assert ok is False
        assert "non-public" in reason

    def test_blocked_hostname_metadata_google(self):
        ok, reason = _url_is_safe("http://metadata.google.internal/compute/")
        assert ok is False
        assert "blocklist" in reason or "scheme" in reason


# ─── LLM output parser ───────────────────────────────────────────────────────


class TestParseEnrichment:
    def test_valid_json_parsed(self):
        raw = json.dumps({
            "summary": "A backend engineer.",
            "topics": ["databases", "systems"],
            "tech_stack": ["Go", "Postgres"],
            "recent_themes": ["Writing about query planners"],
        })
        out = _parse_enrichment(raw)
        assert out is not None
        assert out["schema_version"] == ENRICHMENT_SCHEMA_VERSION
        assert out["summary"] == "A backend engineer."
        assert out["tech_stack"] == ["Go", "Postgres"]

    def test_code_fence_wrapping_is_stripped(self):
        raw = "```json\n" + json.dumps({
            "summary": "x", "topics": [], "tech_stack": [], "recent_themes": [],
        }) + "\n```"
        out = _parse_enrichment(raw)
        assert out is not None
        assert out["summary"] == "x"

    def test_missing_required_keys_returns_none(self):
        raw = json.dumps({"summary": "x", "topics": []})
        assert _parse_enrichment(raw) is None

    def test_non_json_returns_none(self):
        assert _parse_enrichment("not json at all") is None

    def test_summary_truncated_at_240_chars(self):
        long = "a" * 500
        raw = json.dumps({
            "summary": long, "topics": [], "tech_stack": [], "recent_themes": [],
        })
        out = _parse_enrichment(raw)
        assert out is not None
        assert len(out["summary"]) == 240


# ─── run() — batch orchestration ─────────────────────────────────────────────


def _stub_conn(contact_rows):
    """Build a mock psycopg2 connection that yields contact_rows on the first SELECT."""
    conn = MagicMock()

    def cursor_factory():
        cur = MagicMock()
        # fetchone() → user_config row (LLM creds configured)
        cur.fetchone.return_value = ({
            "llm_endpoint": "https://api.stub/v1/chat/completions",
            "llm_api_key": "sk-stub",
        },)
        # fetchall() → contacts awaiting enrichment
        cur.fetchall.return_value = contact_rows
        cur.__enter__ = MagicMock(return_value=cur)
        cur.__exit__ = MagicMock(return_value=False)
        return cur

    conn.cursor.side_effect = lambda: cursor_factory()
    return conn


class _StubProcessor:
    """In-process stand-in for EnrichmentProcessor — avoids the scrapling import chain."""

    def __init__(self, markdown=None, raises=None):
        self._markdown = markdown
        self._raises = raises
        self.calls: list[str] = []

    def enrich_url(self, url: str) -> str:
        self.calls.append(url)
        if self._raises:
            exc = self._raises[0] if isinstance(self._raises, list) else self._raises
            if isinstance(self._raises, list):
                # Drain one element per call so ordered side_effect-style lists work.
                popped = self._raises.pop(0)
                if isinstance(popped, Exception):
                    raise popped
                return popped
            raise exc
        return self._markdown or ""


class TestRunHappyPath:
    @patch("scraper.enrich_contacts._call_llm")
    @patch("scraper.enrich_contacts.psycopg2.connect")
    def test_single_contact_enriched(self, mock_connect, mock_llm):
        # company_name=None → YC fast-path skipped, LLM path taken.
        mock_connect.return_value = _stub_conn([(42, "https://janedoe.dev", None)])
        mock_llm.return_value = {
            "choices": [{"message": {"content": json.dumps({
                "summary": "Backend engineer.",
                "topics": ["databases"],
                "tech_stack": ["Go"],
                "recent_themes": ["Postgres internals"],
            })}}]
        }

        processor = _StubProcessor(markdown="# Jane\nBackend engineer.")
        result = run({"db_url": "postgres://stub", "rate_limit_s": 0}, processor=processor)

        assert result["enriched"] == 1
        assert result["failed"] == 0
        assert result["skipped_guard"] == 0
        assert processor.calls == ["https://janedoe.dev"]


class TestRunErrorPaths:
    @patch("scraper.enrich_contacts.psycopg2.connect")
    def test_ssrf_guard_triggers_skipped_status(self, mock_connect):
        mock_connect.return_value = _stub_conn([(7, "file:///etc/passwd", None)])
        processor = _StubProcessor(markdown="unused")
        result = run({"db_url": "postgres://stub", "rate_limit_s": 0}, processor=processor)
        assert result["skipped_guard"] == 1
        assert result["enriched"] == 0
        # EnrichmentProcessor is never invoked for guarded rows.
        assert processor.calls == []

    @patch("scraper.enrich_contacts._url_is_safe", return_value=(True, ""))
    @patch("scraper.enrich_contacts.psycopg2.connect")
    def test_fetch_failure_marks_failed_and_continues(self, mock_connect, _mock_guard):
        mock_connect.return_value = _stub_conn([
            (1, "https://bad.example.com", None),
            (2, "https://good.example.com", None),
        ])
        processor = _StubProcessor(raises=[RuntimeError("HTTP 500"), "# Good page"])
        with patch("scraper.enrich_contacts._call_llm") as mock_llm:
            mock_llm.return_value = {
                "choices": [{"message": {"content": json.dumps({
                    "summary": "ok", "topics": [], "tech_stack": [], "recent_themes": [],
                })}}]
            }
            result = run({"db_url": "postgres://stub", "rate_limit_s": 0}, processor=processor)
        # Partial failure does NOT abort the batch.
        assert result["failed"] == 1
        assert result["enriched"] == 1


class TestStaleEnrichment:
    """Verify the refresh_days SQL plumbing works without exceptions.

    Real semantic test (does the WHERE clause actually requeue stale rows?)
    requires a live Postgres; covered by manual end-to-end verification.
    These are sanity checks on parameter threading + default fallback.
    """

    @patch("scraper.enrich_contacts.psycopg2.connect")
    def test_refresh_days_zero_disables_stale_branch(self, mock_connect):
        """refresh_days=0 should exit cleanly with no rows — SQL well-formed."""
        mock_connect.return_value = _stub_conn([])
        processor = _StubProcessor()
        result = run(
            {"db_url": "postgres://stub", "refresh_days": 0, "rate_limit_s": 0},
            processor=processor,
        )
        assert result == {"enriched": 0, "failed": 0, "skipped_guard": 0, "errors": []}

    @patch("scraper.enrich_contacts.psycopg2.connect")
    def test_refresh_days_default_ninety(self, mock_connect):
        """Omitted refresh_days falls back to 90 without error."""
        mock_connect.return_value = _stub_conn([])
        processor = _StubProcessor()
        result = run(
            {"db_url": "postgres://stub", "rate_limit_s": 0},
            processor=processor,
        )
        assert result["enriched"] == 0
        assert result["errors"] == []

    @patch("scraper.enrich_contacts.psycopg2.connect")
    def test_negative_refresh_days_clamped_to_zero(self, mock_connect):
        """Invalid negative refresh_days shouldn't crash; clamped at 0."""
        mock_connect.return_value = _stub_conn([])
        processor = _StubProcessor()
        result = run(
            {"db_url": "postgres://stub", "refresh_days": -5, "rate_limit_s": 0},
            processor=processor,
        )
        assert result["errors"] == []


class TestYCFastPath:
    @patch("scraper.enrich_contacts._call_llm")
    @patch("scraper.enrich_contacts.fetch_yc_company")
    @patch("scraper.enrich_contacts.psycopg2.connect")
    def test_yc_hit_bypasses_llm_and_crawler(
        self, mock_connect, mock_fetch_yc, mock_llm,
    ):
        mock_connect.return_value = _stub_conn([(99, "https://stripe.com", "Stripe")])
        mock_fetch_yc.return_value = {
            "funding_stage": "S09",
            "headcount_range": "~8000",
            "description": "Payments infrastructure for the internet.",
            "website": "https://stripe.com",
            "is_hiring": True,
        }

        processor = _StubProcessor(markdown="should not be read")
        result = run({"db_url": "postgres://stub", "rate_limit_s": 0}, processor=processor)

        assert result["enriched"] == 1
        assert result["failed"] == 0
        # Neither crawler nor LLM was touched — YC fast-path wrote straight to DB.
        assert processor.calls == []
        mock_llm.assert_not_called()
        # Verify the contact_name was sent to the YC API.
        mock_fetch_yc.assert_called_once_with("Stripe")

    @patch("scraper.enrich_contacts._call_llm")
    @patch("scraper.enrich_contacts.fetch_yc_company", return_value=None)
    @patch("scraper.enrich_contacts.psycopg2.connect")
    def test_yc_miss_falls_back_to_llm(
        self, mock_connect, _mock_fetch_yc, mock_llm,
    ):
        mock_connect.return_value = _stub_conn([(100, "https://bob.dev", "NonYCCorp")])
        mock_llm.return_value = {
            "choices": [{"message": {"content": json.dumps({
                "summary": "ok", "topics": [], "tech_stack": [], "recent_themes": [],
            })}}]
        }
        processor = _StubProcessor(markdown="# Bob")

        result = run({"db_url": "postgres://stub", "rate_limit_s": 0}, processor=processor)

        assert result["enriched"] == 1
        # Crawler + LLM both exercised because YC API returned None.
        assert processor.calls == ["https://bob.dev"]
        mock_llm.assert_called_once()

    @patch("scraper.enrich_contacts.psycopg2.connect")
    def test_llm_not_configured_short_circuits(self, mock_connect):
        conn = MagicMock()

        def cursor_factory():
            cur = MagicMock()
            cur.fetchone.return_value = ({},)  # No llm_endpoint / api_key
            cur.__enter__ = MagicMock(return_value=cur)
            cur.__exit__ = MagicMock(return_value=False)
            return cur

        conn.cursor.side_effect = lambda: cursor_factory()
        mock_connect.return_value = conn

        result = run({"db_url": "postgres://stub"})
        assert result["enriched"] == 0
        assert any("LLM" in err for err in result["errors"])

    def test_missing_db_url(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DATABASE_URL", None)
            result = run({})
        assert result["enriched"] == 0
        assert "db_url missing" in result["errors"][0]
