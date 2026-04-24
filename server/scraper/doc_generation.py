"""Doc-generation module — tailor the master resume per job and compile to PDF.

Pipeline slot: `processing`, execution_order=20. Registered via pipeline_modules
row seeded in migrations/20250101000000_init.sql and dispatched by the runner at
`/run/doc-generation`.

Flow per job:
  1. SELECT jobs in state='filtered' that don't have an applications row yet.
  2. Load active master_resume (latex_source).
  3. LLM-draft a subtractive diff: {blocks_to_keep, bullets_swapped, keywords_added, cover_emphasis}.
  4. INSERT applications row, apply_diff() on master → tailored .tex.
  5. Compile with `tectonic` subprocess → PDF bytes.
  6. UPDATE applications with resume_latex + resume_pdf.
  7. INSERT resume_diffs audit row.
  8. UPDATE jobs.state = 'queued' (guarded against races with a WHERE state='filtered').

Per-job errors flip the single job to 'docs-failed' with a short docs_fail_reason;
batch continues. Trailing stdout line is JSON for the runner.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional
import urllib.error
import urllib.request

import psycopg2

from apply_diff import apply_diff
from scraper.crypto_helper import decrypt_config


TECTONIC_TIMEOUT_S = 120
LLM_TIMEOUT_S = 60


_SYSTEM_PROMPT = (
    "You are a precision resume-tailoring engine. You return JSON only — no prose, "
    "no code fences, no explanation. Your output is applied to a master LaTeX "
    "resume by a deterministic post-processor; hallucinated block names or mangled "
    "JSON will fail the job."
)

_USER_PROMPT_TEMPLATE = """\
A user is applying to this job. Tailor their master resume by (a) selecting
which experience blocks to keep, (b) proposing targeted bullet rewrites, and
(c) emitting keywords to inject into the skills section.

# Job
Title: {title}
Company: {company}
Description (truncated):
{description}

# Master resume (LaTeX)
Block markers in the form `% <BLOCK:Name> ... % <ENDBLOCK:Name>` delimit
removable sections. Only those named blocks can be kept or dropped.

{master_latex}

# Output JSON schema
Return a JSON object with exactly these keys:

  "blocks_to_keep": array of block names (strings) to keep. Omit this key or
      pass null to keep ALL blocks (no subtractive tailoring).
  "bullets_swapped": array of {{"remove": "<exact substring from master>", "add": "<replacement>"}}.
      Limit 4. Each "remove" must be an exact substring of the master above.
  "keywords_added": array of 3-8 short skill/tool keywords to inject into the
      skills line (comma-separated).
  "cover_emphasis": one short paragraph (<=400 chars) describing what the
      cover letter should emphasize for this job. Used by the cover-letter
      module downstream.

Return valid JSON only.
"""


# ────────────────────────────────────────────────────────────────────────────
# LLM helpers (mirrors outreach_drafting.py / enrich_contacts.py patterns)
# ────────────────────────────────────────────────────────────────────────────


def _build_llm_request(cfg: Dict[str, Any], user_prompt: str) -> tuple[Dict[str, str], Dict[str, Any]]:
    """Build an OpenAI-compatible chat-completions request.

    The endpoint must accept OpenAI's `/v1/chat/completions` shape. This works
    with OpenAI, Gemini's `/v1beta/openai` path, OpenRouter, Ollama, LM Studio,
    etc. For native Anthropic Claude, users must route through OpenRouter or
    a LiteLLM proxy.
    """
    model = cfg.get("llm_model_override") or cfg.get("llm_model") or "gemini-1.5-flash"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {cfg.get('llm_api_key') or ''}",
    }
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 1500,
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }
    return headers, body


def _extract_text(data: Dict[str, Any]) -> str:
    return data["choices"][0]["message"]["content"].strip()


def _call_llm(endpoint: str, headers: Dict[str, str], body: Dict[str, Any], timeout: int = LLM_TIMEOUT_S) -> Dict[str, Any]:
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _parse_llm_diff(raw: str) -> Optional[Dict[str, Any]]:
    """Parse LLM output. Lifted from enrich_contacts._parse_enrichment: tolerates
    a ```json ... ``` code-fence wrapper some providers emit."""
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        stripped = raw.strip().strip("`")
        if stripped.startswith("json"):
            stripped = stripped[4:].lstrip()
        try:
            obj = json.loads(stripped)
        except json.JSONDecodeError:
            return None
    if not isinstance(obj, dict):
        return None
    # Normalize: missing keys are OK; apply_diff handles partial diffs.
    return {
        "blocks_to_keep": obj.get("blocks_to_keep"),
        "bullets_swapped": obj.get("bullets_swapped") or [],
        "keywords_added": obj.get("keywords_added") or [],
        "cover_emphasis": str(obj.get("cover_emphasis") or "")[:500],
    }


# ────────────────────────────────────────────────────────────────────────────
# Tectonic PDF compilation
# ────────────────────────────────────────────────────────────────────────────


def _compile_pdf(tex_source: str) -> bytes:
    """Write .tex to a temp dir, run tectonic, return the PDF bytes. Raises
    RuntimeError with the tectonic stderr tail on failure."""
    with tempfile.TemporaryDirectory(prefix="notiapply_docgen_") as tmp:
        tex_path = Path(tmp) / "resume.tex"
        tex_path.write_text(tex_source, encoding="utf-8")
        try:
            subprocess.run(
                ["tectonic", "--chatter", "minimal", "--outdir", tmp, str(tex_path)],
                cwd=tmp,
                check=True,
                timeout=TECTONIC_TIMEOUT_S,
                capture_output=True,
            )
        except FileNotFoundError as exc:
            raise RuntimeError("tectonic binary not on PATH") from exc
        except subprocess.CalledProcessError as exc:
            err_tail = (exc.stderr or b"")[-400:].decode("utf-8", errors="replace")
            raise RuntimeError(f"tectonic failed: {err_tail}") from exc
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(f"tectonic timed out after {TECTONIC_TIMEOUT_S}s") from exc

        pdf_path = Path(tmp) / "resume.pdf"
        if not pdf_path.is_file():
            raise RuntimeError("tectonic produced no PDF")
        return pdf_path.read_bytes()


# ────────────────────────────────────────────────────────────────────────────
# DB helpers
# ────────────────────────────────────────────────────────────────────────────


def _load_llm_config(cur) -> Dict[str, Any]:
    cur.execute("SELECT config FROM user_config WHERE id = 1")
    row = cur.fetchone()
    return decrypt_config((row[0] if row else {}) or {})


def _load_active_master(cur) -> Optional[tuple[int, str]]:
    cur.execute(
        """
        SELECT id, latex_source
          FROM master_resume
         WHERE is_active = true
         ORDER BY created_at DESC
         LIMIT 1
        """,
    )
    row = cur.fetchone()
    return (row[0], row[1]) if row else None


def _fetch_eligible_jobs(cur, batch_size: int) -> List[Dict[str, Any]]:
    cur.execute(
        """
        SELECT j.id, j.title, j.company, j.description_raw
          FROM jobs j
          LEFT JOIN applications a ON a.job_id = j.id
         WHERE j.state = 'filtered'
           AND a.id IS NULL
         ORDER BY j.relevance_score DESC NULLS LAST, j.discovered_at DESC
         LIMIT %s
        """,
        (batch_size,),
    )
    return [
        {"id": r[0], "title": r[1], "company": r[2], "description_raw": r[3]}
        for r in cur.fetchall()
    ]


def _create_application(conn, job_id: int, master_resume_id: int) -> int:
    """Insert the applications row. Caller owns the transaction commit — if a
    later persist/transition step fails, `conn.rollback()` discards this insert
    so we don't leak an orphan applications row."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO applications (job_id, master_resume_id, queued_at)
            VALUES (%s, %s, NOW())
            RETURNING id
            """,
            (job_id, master_resume_id),
        )
        app_id = cur.fetchone()[0]
    return app_id


def _persist_docs(conn, app_id: int, tex: str, pdf_bytes: bytes, diff: Dict[str, Any], llm_raw: str) -> None:
    """Persist tailored docs. Caller owns the transaction commit."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE applications
               SET resume_latex = %s,
                   resume_pdf = %s
             WHERE id = %s
            """,
            (tex, psycopg2.Binary(pdf_bytes), app_id),
        )
        cur.execute(
            """
            INSERT INTO resume_diffs (application_id, llm_raw, bullets_swapped, keywords_added, cover_emphasis)
            VALUES (%s, %s::jsonb, %s::jsonb, %s::jsonb, %s)
            """,
            (
                app_id,
                llm_raw,
                json.dumps(diff.get("bullets_swapped") or []),
                json.dumps(diff.get("keywords_added") or []),
                diff.get("cover_emphasis"),
            ),
        )


def _transition_queued(conn, job_id: int) -> None:
    """Race-safe: only transition if still in 'filtered'. Caller owns the commit."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE jobs SET state = 'queued' WHERE id = %s AND state = 'filtered'",
            (job_id,),
        )


def _mark_failed(conn, job_id: int, reason: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE jobs
               SET state = 'docs-failed',
                   docs_fail_reason = %s
             WHERE id = %s AND state = 'filtered'
            """,
            (reason[:500], job_id),
        )
    conn.commit()


# ────────────────────────────────────────────────────────────────────────────
# Runner entry point
# ────────────────────────────────────────────────────────────────────────────


def run(payload: Dict[str, Any]) -> Dict[str, Any]:
    db_url = payload.get("db_url") or os.environ.get("DATABASE_URL")
    if not db_url:
        return {"generated": 0, "failed": 0, "no_op": 0, "errors": ["db_url missing"]}

    batch_size = max(1, min(int(payload.get("batch_size", 5)), 20))
    errors: List[str] = []
    generated = 0
    failed = 0
    no_op = 0

    conn = psycopg2.connect(db_url)
    try:
        cur = conn.cursor()
        cfg = _load_llm_config(cur)
        endpoint = cfg.get("llm_endpoint")
        api_key = cfg.get("llm_api_key")

        if not endpoint or not api_key:
            cur.close()
            return {
                "generated": 0,
                "failed": 0,
                "no_op": 0,
                "errors": ["LLM endpoint/api_key not configured in user_config"],
            }

        master = _load_active_master(cur)
        if master is None:
            cur.close()
            return {
                "generated": 0,
                "failed": 0,
                "no_op": 0,
                "errors": ["no active master_resume row — seed one via the Settings UI"],
            }
        master_id, master_latex = master

        jobs = _fetch_eligible_jobs(cur, batch_size)
        cur.close()

        for job in jobs:
            try:
                user_prompt = _USER_PROMPT_TEMPLATE.format(
                    title=job["title"],
                    company=job["company"],
                    description=(job["description_raw"] or "")[:8000],
                    master_latex=master_latex[:16000],
                )
                headers, body = _build_llm_request(cfg, user_prompt)
                data = _call_llm(endpoint, headers, body)
                raw_text = _extract_text(data)
            except urllib.error.HTTPError as exc:
                failed += 1
                errors.append(f"job {job['id']}: LLM HTTP {exc.code}")
                _mark_failed(conn, job["id"], f"LLM HTTP {exc.code}")
                continue
            except Exception as exc:  # noqa: BLE001
                failed += 1
                errors.append(f"job {job['id']}: llm call: {exc}")
                _mark_failed(conn, job["id"], f"llm call: {exc}")
                continue

            diff = _parse_llm_diff(raw_text)
            if diff is None:
                failed += 1
                errors.append(f"job {job['id']}: malformed LLM JSON")
                _mark_failed(conn, job["id"], "malformed LLM JSON")
                continue

            try:
                tailored_tex = apply_diff(master_latex, diff)
            except Exception as exc:  # noqa: BLE001
                failed += 1
                errors.append(f"job {job['id']}: apply_diff: {exc}")
                _mark_failed(conn, job["id"], f"apply_diff: {exc}")
                continue

            try:
                pdf_bytes = _compile_pdf(tailored_tex)
            except Exception as exc:  # noqa: BLE001
                failed += 1
                errors.append(f"job {job['id']}: compile: {exc}")
                _mark_failed(conn, job["id"], f"compile: {exc}")
                continue

            try:
                app_id = _create_application(conn, job["id"], master_id)
                _persist_docs(conn, app_id, tailored_tex, pdf_bytes, diff, raw_text)
                _transition_queued(conn, job["id"])
                conn.commit()  # atomic: all three steps or none (no orphan applications row)
                generated += 1
                print(f"doc-generation: job #{job['id']} queued (app #{app_id})", file=sys.stderr)
            except Exception as exc:  # noqa: BLE001
                conn.rollback()
                failed += 1
                errors.append(f"job {job['id']}: persist: {exc}")
                _mark_failed(conn, job["id"], f"persist: {exc}")
                continue

    finally:
        conn.close()

    return {
        "generated": generated,
        "failed": failed,
        "no_op": no_op,
        "errors": errors,
    }


if __name__ == "__main__":
    raw = sys.argv[1] if len(sys.argv) > 1 else "{}"
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        payload = {}
    result = run(payload)
    print(json.dumps(result))
