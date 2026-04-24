"""Tests for the gmail_watcher runner module.

Focus on the logic we added: dedupe against interaction_log message_id,
graceful degradation when the token is missing, and the runner JSON contract
(trailing stdout line parses as JSON).
"""
from __future__ import annotations

import json
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from gmail_watcher import _already_logged, _extract_email, run  # noqa: E402


# ─── Pure helpers ────────────────────────────────────────────────────────────


class TestExtractEmail:
    def test_name_wrapped_format(self):
        assert _extract_email("Jane Doe <jane@example.com>") == "jane@example.com"

    def test_bare_address(self):
        assert _extract_email("jane@example.com") == "jane@example.com"

    def test_strips_whitespace(self):
        assert _extract_email("  jane@example.com  ") == "jane@example.com"


class TestAlreadyLogged:
    def test_empty_log_returns_false(self):
        assert _already_logged([], "m1") is False

    def test_matching_message_id_returns_true(self):
        log = [{"event": "Email reply received", "message_id": "abc123"}]
        assert _already_logged(log, "abc123") is True

    def test_different_message_id_returns_false(self):
        log = [{"event": "Email reply received", "message_id": "abc123"}]
        assert _already_logged(log, "def456") is False

    def test_ignores_entries_without_message_id(self):
        log = [{"event": "Manual note"}, {"event": "Reply", "message_id": "real"}]
        assert _already_logged(log, "real") is True
        assert _already_logged(log, "Manual note") is False


# ─── run() — runner entry point ──────────────────────────────────────────────


class TestRun:
    def test_missing_db_url_returns_error(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DATABASE_URL", None)
            result = run({})
        assert result["processed"] == 0
        assert "db_url missing" in result["errors"][0]

    @patch("gmail_watcher.get_gmail_service", side_effect=FileNotFoundError("no token"))
    def test_missing_token_short_circuits(self, _mock_svc):
        result = run({"db_url": "postgres://stub"})
        assert result == {"processed": 0, "replied": 0, "skipped_duplicates": 0, "errors": ["no token"]}

    @patch("gmail_watcher._record_reply")
    @patch("gmail_watcher._find_replies")
    @patch("gmail_watcher._fetch_awaiting_contacts")
    @patch("gmail_watcher.get_gmail_service")
    def test_happy_path_records_single_reply(
        self, mock_service, mock_fetch, mock_find, mock_record,
    ):
        mock_service.return_value = MagicMock()
        mock_fetch.return_value = [
            {
                "id": 7,
                "name": "Jane",
                "email": "jane@example.com",
                "company_name": "Acme",
                "last_contacted_at": None,
                "interaction_log": [],
            }
        ]
        mock_find.return_value = [
            {
                "contact_id": 7,
                "contact_name": "Jane",
                "contact_interaction_log": [],
                "email": "jane@example.com",
                "subject": "Re: your note",
                "snippet": "Thanks for reaching out",
                "message_id": "msg-42",
            }
        ]

        result = run({"db_url": "postgres://stub"})

        assert result["replied"] == 1
        assert result["skipped_duplicates"] == 0
        assert result["errors"] == []
        mock_record.assert_called_once()
        # Ensure the message_id is the second-positional field we persist.
        _, args, _kwargs = mock_record.mock_calls[0]
        assert args[2]["message_id"] == "msg-42"

    @patch("gmail_watcher._record_reply")
    @patch("gmail_watcher._find_replies")
    @patch("gmail_watcher._fetch_awaiting_contacts")
    @patch("gmail_watcher.get_gmail_service")
    def test_duplicate_message_id_is_skipped(
        self, mock_service, mock_fetch, mock_find, mock_record,
    ):
        mock_service.return_value = MagicMock()
        existing_log = [{"event": "Email reply received", "message_id": "msg-dupe"}]
        mock_fetch.return_value = [
            {
                "id": 9,
                "name": "Dup",
                "email": "dup@example.com",
                "company_name": "X",
                "last_contacted_at": None,
                "interaction_log": existing_log,
            }
        ]
        mock_find.return_value = [
            {
                "contact_id": 9,
                "contact_name": "Dup",
                "contact_interaction_log": existing_log,
                "email": "dup@example.com",
                "subject": "Re:",
                "snippet": "seen before",
                "message_id": "msg-dupe",
            }
        ]

        result = run({"db_url": "postgres://stub"})

        assert result["replied"] == 0
        assert result["skipped_duplicates"] == 1
        mock_record.assert_not_called()

    @patch("gmail_watcher._fetch_awaiting_contacts", return_value=[])
    @patch("gmail_watcher.get_gmail_service")
    def test_no_awaiting_contacts_returns_zero(self, _svc, _fetch):
        result = run({"db_url": "postgres://stub"})
        assert result == {"processed": 0, "replied": 0, "skipped_duplicates": 0, "errors": []}


# ─── Runner stdout contract ──────────────────────────────────────────────────


def test_run_result_is_json_serializable():
    """The runner parses the last stdout line as JSON — the return shape must serialize."""
    payload = {
        "processed": 2,
        "replied": 1,
        "skipped_duplicates": 1,
        "errors": ["example"],
    }
    assert json.loads(json.dumps(payload)) == payload
