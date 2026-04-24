"""Tests for server/scraper/cover_letter.py.

Mocks the LLM (urllib) and tectonic subprocess. Verifies template substitution
with LaTeX-escaped values, guard paths (missing db_url / llm / template), and
partial-batch failure tolerance.
"""
from __future__ import annotations

import json
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scraper.cover_letter import (  # noqa: E402
    _fill_template,
    _latex_escape,
    run,
)


_SAMPLE_TEMPLATE = (
    r"\documentclass{article}\begin{document}"
    r"Dear {{COMPANY}}, I'm applying for {{POSITION}}.\\"
    r"{{BODY}}\end{document}"
)


def _stub_conn(*, applications=None, has_template=True, cfg_valid=True):
    """Mock psycopg2 connection serving 3 SELECTs: user_config, template, applications."""
    applications = applications or []
    conn = MagicMock()
    load_cur = MagicMock()

    cfg_row = (
        {
            "llm_endpoint": "https://api.stub/v1/chat/completions",
            "llm_api_key": "sk-stub",
        },
    ) if cfg_valid else ({},)

    template_row = (_SAMPLE_TEMPLATE,) if has_template else None

    load_cur.fetchone.side_effect = [cfg_row, template_row]
    load_cur.fetchall.return_value = [
        (a["id"], a["title"], a["company"], a["cover_emphasis"]) for a in applications
    ]
    load_cur.__enter__ = MagicMock(return_value=load_cur)
    load_cur.__exit__ = MagicMock(return_value=False)

    update_cur = MagicMock()
    update_cur.__enter__ = MagicMock(return_value=update_cur)
    update_cur.__exit__ = MagicMock(return_value=False)

    cursors_served = {"n": 0}

    def _cursor_factory():
        cursors_served["n"] += 1
        return load_cur if cursors_served["n"] == 1 else update_cur

    conn.cursor.side_effect = _cursor_factory
    return conn


# ─── Pure helpers ────────────────────────────────────────────────────────────


class TestLatexEscape:
    def test_ampersand_escaped(self):
        assert _latex_escape("Johnson & Johnson") == r"Johnson \& Johnson"

    def test_percent_and_underscore(self):
        assert _latex_escape("100% win_rate") == r"100\% win\_rate"

    def test_braces_escaped(self):
        assert _latex_escape("{a}") == r"\{a\}"

    def test_plain_text_unchanged(self):
        assert _latex_escape("Hello world.") == "Hello world."


class TestFillTemplate:
    def test_all_placeholders_substituted(self):
        out = _fill_template(_SAMPLE_TEMPLATE, "Acme", "Engineer", "I love Acme.")
        assert "{{COMPANY}}" not in out
        assert "{{POSITION}}" not in out
        assert "{{BODY}}" not in out
        assert "Acme" in out
        assert "Engineer" in out

    def test_body_latex_escaped(self):
        """Body text with LaTeX-special chars should be escaped before substitution."""
        out = _fill_template(_SAMPLE_TEMPLATE, "Co", "Dev", "I love 100% coverage & tests.")
        assert r"100\% coverage \& tests" in out


# ─── run() ───────────────────────────────────────────────────────────────────


class TestRunGuards:
    def test_missing_db_url(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DATABASE_URL", None)
            result = run({})
        assert result["generated"] == 0
        assert "db_url missing" in result["errors"][0]

    @patch("scraper.cover_letter.psycopg2.connect")
    def test_missing_llm_config(self, mock_connect):
        mock_connect.return_value = _stub_conn(cfg_valid=False)
        result = run({"db_url": "postgres://stub"})
        assert result["generated"] == 0
        assert any("LLM" in e for e in result["errors"])

    @patch("scraper.cover_letter.psycopg2.connect")
    def test_missing_template(self, mock_connect):
        mock_connect.return_value = _stub_conn(has_template=False)
        result = run({"db_url": "postgres://stub"})
        assert result["generated"] == 0
        assert any("cover_letter_templates" in e for e in result["errors"])


class TestRunHappyPath:
    @patch("scraper.cover_letter._compile_pdf", return_value=b"%PDF-1.4\nstub")
    @patch("scraper.cover_letter._call_llm")
    @patch("scraper.cover_letter.psycopg2.connect")
    def test_single_application_generated(self, mock_connect, mock_llm, mock_compile):
        apps = [{"id": 21, "title": "SRE", "company": "Acme", "cover_emphasis": "Care about reliability."}]
        mock_connect.return_value = _stub_conn(applications=apps)
        mock_llm.return_value = {
            "choices": [{"message": {"content": "I am deeply excited to join Acme's SRE team..."}}]
        }

        result = run({"db_url": "postgres://stub"})
        assert result["generated"] == 1
        assert result["failed"] == 0
        mock_compile.assert_called_once()

    @patch("scraper.cover_letter._compile_pdf", return_value=b"%PDF")
    @patch("scraper.cover_letter._call_llm")
    @patch("scraper.cover_letter.psycopg2.connect")
    def test_empty_cover_emphasis_tolerated(self, mock_connect, mock_llm, _mock_compile):
        """A resume_diffs row may have NULL cover_emphasis — the prompt should
        still work and use a reasonable default."""
        apps = [{"id": 22, "title": "PM", "company": "Beta", "cover_emphasis": ""}]
        mock_connect.return_value = _stub_conn(applications=apps)
        mock_llm.return_value = {"choices": [{"message": {"content": "body."}}]}
        result = run({"db_url": "postgres://stub"})
        assert result["generated"] == 1


class TestRunErrorPaths:
    @patch("scraper.cover_letter._compile_pdf", side_effect=RuntimeError("tectonic failed"))
    @patch("scraper.cover_letter._call_llm")
    @patch("scraper.cover_letter.psycopg2.connect")
    def test_compile_failure_logs_and_continues(self, mock_connect, mock_llm, _mock_compile):
        apps = [
            {"id": 31, "title": "A", "company": "X", "cover_emphasis": "e"},
            {"id": 32, "title": "B", "company": "Y", "cover_emphasis": "e"},
        ]
        mock_connect.return_value = _stub_conn(applications=apps)
        mock_llm.return_value = {"choices": [{"message": {"content": "ok"}}]}

        result = run({"db_url": "postgres://stub"})
        # Both failed, but neither aborted the batch.
        assert result["generated"] == 0
        assert result["failed"] == 2

    @patch("scraper.cover_letter._call_llm", side_effect=ValueError("bad request"))
    @patch("scraper.cover_letter.psycopg2.connect")
    def test_llm_failure_logs_and_continues(self, mock_connect, _mock_llm):
        apps = [{"id": 41, "title": "A", "company": "X", "cover_emphasis": "e"}]
        mock_connect.return_value = _stub_conn(applications=apps)
        result = run({"db_url": "postgres://stub"})
        assert result["failed"] == 1
        assert any("llm call" in e for e in result["errors"])


class TestTone:
    @patch("scraper.cover_letter._compile_pdf", return_value=b"%PDF")
    @patch("scraper.cover_letter._call_llm")
    @patch("scraper.cover_letter.psycopg2.connect")
    def test_unknown_tone_falls_back_to_professional(self, mock_connect, mock_llm, _mock_compile):
        apps = [{"id": 51, "title": "X", "company": "Y", "cover_emphasis": "e"}]
        mock_connect.return_value = _stub_conn(applications=apps)
        mock_llm.return_value = {"choices": [{"message": {"content": "ok"}}]}
        result = run({"db_url": "postgres://stub", "tone": "lunatic-ravings"})
        # Unknown tone should not break the run — defaults to professional.
        assert result["generated"] == 1
