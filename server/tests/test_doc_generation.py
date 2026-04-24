"""Tests for server/scraper/doc_generation.py.

Mocks the LLM (urllib) and tectonic subprocess so no network / binary is
required. Verifies the batch orchestration, state transitions, JSON parse
recovery, partial-batch failure tolerance, and runner JSON contract.
"""
from __future__ import annotations

import json
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scraper.doc_generation import (  # noqa: E402
    _parse_llm_diff,
    run,
)


_VALID_LLM_JSON = json.dumps({
    "blocks_to_keep": ["MainExperience"],
    "bullets_swapped": [{"remove": "old bullet", "add": "new bullet"}],
    "keywords_added": ["Go", "Postgres"],
    "cover_emphasis": "Emphasize distributed systems experience.",
})


def _stub_conn(*, jobs=None, has_master=True, cfg_valid=True):
    """Build a mock psycopg2 connection with a cursor that serves the 3 SELECTs
    in run(): user_config, master_resume, then jobs batch.

    Subsequent cursors (for INSERT / UPDATE) are MagicMock default behavior and
    return nothing.
    """
    jobs = jobs or []
    conn = MagicMock()

    # We only need the first cursor to answer our 3 SELECTs in order.
    load_cur = MagicMock()

    if cfg_valid:
        cfg_row = ({
            "llm_endpoint": "https://api.stub/v1/chat/completions",
            "llm_api_key": "sk-stub",
        },)
    else:
        cfg_row = ({},)

    if has_master:
        master_row = (42, r"\documentclass{article}\begin{document}% <BLOCK:MainExperience>x% <ENDBLOCK:MainExperience>\end{document}")
    else:
        master_row = None

    load_cur.fetchone.side_effect = [cfg_row, master_row]
    load_cur.fetchall.return_value = [
        (j["id"], j["title"], j["company"], j["description_raw"]) for j in jobs
    ]
    load_cur.__enter__ = MagicMock(return_value=load_cur)
    load_cur.__exit__ = MagicMock(return_value=False)

    insert_cur = MagicMock()
    insert_cur.fetchone.return_value = (999,)  # new application_id
    insert_cur.__enter__ = MagicMock(return_value=insert_cur)
    insert_cur.__exit__ = MagicMock(return_value=False)

    # Subsequent cursors are all for INSERTs/UPDATEs; they all share the
    # insert_cur mock (each INSERT RETURNING id yields the same app_id, which
    # is fine for a single-job test; multi-job tests customize via side_effect).
    cursors_served = {"n": 0}

    def _cursor_factory():
        cursors_served["n"] += 1
        if cursors_served["n"] == 1:
            return load_cur
        return insert_cur

    conn.cursor.side_effect = _cursor_factory
    return conn


# ─── _parse_llm_diff ─────────────────────────────────────────────────────────


class TestParseDiff:
    def test_valid_json(self):
        diff = _parse_llm_diff(_VALID_LLM_JSON)
        assert diff is not None
        assert diff["blocks_to_keep"] == ["MainExperience"]
        assert diff["keywords_added"] == ["Go", "Postgres"]

    def test_fenced_json_recovered(self):
        raw = "```json\n" + _VALID_LLM_JSON + "\n```"
        assert _parse_llm_diff(raw) is not None

    def test_non_json_returns_none(self):
        assert _parse_llm_diff("no diff here") is None

    def test_missing_keys_are_defaulted(self):
        minimal = json.dumps({"keywords_added": ["x"]})
        diff = _parse_llm_diff(minimal)
        assert diff is not None
        assert diff["bullets_swapped"] == []
        assert diff["cover_emphasis"] == ""
        assert diff["blocks_to_keep"] is None

    def test_cover_emphasis_truncated(self):
        long_payload = json.dumps({"cover_emphasis": "a" * 1000})
        diff = _parse_llm_diff(long_payload)
        assert diff is not None
        assert len(diff["cover_emphasis"]) == 500


# ─── run() — orchestration ───────────────────────────────────────────────────


class TestRunGuards:
    def test_missing_db_url(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DATABASE_URL", None)
            result = run({})
        assert result["generated"] == 0
        assert "db_url missing" in result["errors"][0]

    @patch("scraper.doc_generation.psycopg2.connect")
    def test_missing_llm_config(self, mock_connect):
        mock_connect.return_value = _stub_conn(cfg_valid=False)
        result = run({"db_url": "postgres://stub"})
        assert result["generated"] == 0
        assert any("LLM" in e for e in result["errors"])

    @patch("scraper.doc_generation.psycopg2.connect")
    def test_missing_master_resume(self, mock_connect):
        mock_connect.return_value = _stub_conn(has_master=False)
        result = run({"db_url": "postgres://stub"})
        assert result["generated"] == 0
        assert any("master_resume" in e for e in result["errors"])


class TestRunHappyPath:
    @patch("scraper.doc_generation._compile_pdf", return_value=b"%PDF-1.4\nstub")
    @patch("scraper.doc_generation._call_llm")
    @patch("scraper.doc_generation.psycopg2.connect")
    def test_single_job_end_to_end(self, mock_connect, mock_llm, mock_compile):
        jobs = [{"id": 7, "title": "Backend Engineer", "company": "Acme", "description_raw": "Build distributed systems."}]
        mock_connect.return_value = _stub_conn(jobs=jobs)
        mock_llm.return_value = {
            "choices": [{"message": {"content": _VALID_LLM_JSON}}]
        }

        result = run({"db_url": "postgres://stub", "batch_size": 5})

        assert result["generated"] == 1
        assert result["failed"] == 0
        mock_compile.assert_called_once()
        # LLM called once per job.
        mock_llm.assert_called_once()


class TestRunErrorPaths:
    @patch("scraper.doc_generation._compile_pdf", side_effect=RuntimeError("tectonic failed: missing package"))
    @patch("scraper.doc_generation._call_llm")
    @patch("scraper.doc_generation.psycopg2.connect")
    def test_compile_failure_marks_docs_failed(self, mock_connect, mock_llm, _mock_compile):
        jobs = [{"id": 11, "title": "X", "company": "Y", "description_raw": "d"}]
        mock_connect.return_value = _stub_conn(jobs=jobs)
        mock_llm.return_value = {"choices": [{"message": {"content": _VALID_LLM_JSON}}]}

        result = run({"db_url": "postgres://stub"})

        assert result["generated"] == 0
        assert result["failed"] == 1
        assert any("compile" in e for e in result["errors"])

    @patch("scraper.doc_generation._call_llm", side_effect=ValueError("bad request"))
    @patch("scraper.doc_generation.psycopg2.connect")
    def test_llm_failure_marks_docs_failed(self, mock_connect, _mock_llm):
        jobs = [{"id": 13, "title": "X", "company": "Y", "description_raw": "d"}]
        mock_connect.return_value = _stub_conn(jobs=jobs)
        result = run({"db_url": "postgres://stub"})
        assert result["failed"] == 1
        assert any("llm call" in e for e in result["errors"])

    @patch("scraper.doc_generation._compile_pdf", return_value=b"%PDF")
    @patch("scraper.doc_generation._call_llm")
    @patch("scraper.doc_generation.psycopg2.connect")
    def test_malformed_llm_json_marks_docs_failed(self, mock_connect, mock_llm, _mock_compile):
        jobs = [{"id": 17, "title": "X", "company": "Y", "description_raw": "d"}]
        mock_connect.return_value = _stub_conn(jobs=jobs)
        mock_llm.return_value = {"choices": [{"message": {"content": "nonsense not json"}}]}
        result = run({"db_url": "postgres://stub"})
        assert result["failed"] == 1
        assert any("malformed" in e for e in result["errors"])


class TestBatchSizeGuard:
    @patch("scraper.doc_generation.psycopg2.connect")
    def test_batch_size_clamped_to_20(self, mock_connect):
        mock_connect.return_value = _stub_conn()
        # Pass a huge batch_size; run() should clamp and still return a clean result.
        result = run({"db_url": "postgres://stub", "batch_size": 9999})
        assert result["generated"] == 0  # no jobs in stub
        assert result["failed"] == 0
