"""Cover-letter module — expand the cover template body per application and compile to PDF.

Pipeline slot: `processing`, execution_order=30. Depends on `doc-generation`
(runs earlier, produces `resume_diffs.cover_emphasis`).

Flow per application:
  1. SELECT applications where resume_pdf IS NOT NULL and cover_letter_pdf IS NULL.
  2. Load active cover_letter_templates.latex_source (with {{COMPANY}}, {{POSITION}}, {{BODY}} placeholders).
  3. LLM-expand a 3-4 sentence body from `cover_emphasis` + job title/company + tone.
  4. Substitute placeholders, compile with tectonic, UPDATE applications.cover_letter_latex/cover_letter_pdf.

Per-application errors are logged but do NOT fail the batch or transition any
job state — the resume is already queued; the cover letter is best-effort.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any, Dict, List, Optional
import urllib.error
import urllib.request

import psycopg2

from scraper.crypto_helper import decrypt_config
from scraper.doc_generation import _compile_pdf  # reuse tectonic wrapper


LLM_TIMEOUT_S = 30

_TONE_PROMPTS = {
    "professional": (
        "Formal, warm, results-oriented. No emoji or exclamation. "
        "Assume a hiring manager at a mature company will read it."
    ),
    "enthusiastic": (
        "Energetic and personable, but not giddy. One subtle expression of "
        "excitement allowed. Assume an early-stage startup audience."
    ),
    "technical": (
        "Technically dense. Reference specific stacks/projects where credible. "
        "Assume a senior engineer or tech lead will read it."
    ),
}

_SYSTEM_PROMPT = (
    "You are a cover-letter body writer. Return exactly one paragraph of 3-4 "
    "sentences. Do NOT include a greeting, signature, or the company name — "
    "those are filled in by the template. Return plain text, no markdown, no "
    "quotes around the paragraph."
)

_USER_PROMPT_TEMPLATE = """\
Write the body paragraph of a cover letter with this guidance.

# Job
Title: {title}
Company: {company}

# Cover emphasis (from resume-tailoring step)
{cover_emphasis}

# Tone
{tone_description}

Return the body paragraph directly, no framing text."""


# ────────────────────────────────────────────────────────────────────────────
# LLM (uses the same provider routing as doc_generation / outreach_drafting)
# ────────────────────────────────────────────────────────────────────────────


def _build_llm_request(cfg: Dict[str, Any], user_prompt: str) -> tuple[Dict[str, str], Dict[str, Any]]:
    """OpenAI-compatible chat-completions. See doc_generation._build_llm_request for rationale."""
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
        "max_tokens": 400,
        "temperature": 0.5,
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


# ────────────────────────────────────────────────────────────────────────────
# LaTeX-safe placeholder substitution
# ────────────────────────────────────────────────────────────────────────────


_LATEX_ESCAPES = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


def _latex_escape(text: str) -> str:
    out = []
    for ch in text:
        out.append(_LATEX_ESCAPES.get(ch, ch))
    return "".join(out)


def _fill_template(template: str, company: str, position: str, body: str) -> str:
    return (
        template
        .replace("{{COMPANY}}", _latex_escape(company))
        .replace("{{POSITION}}", _latex_escape(position))
        .replace("{{BODY}}", _latex_escape(body))
    )


# ────────────────────────────────────────────────────────────────────────────
# DB helpers
# ────────────────────────────────────────────────────────────────────────────


def _load_llm_config(cur) -> Dict[str, Any]:
    cur.execute("SELECT config FROM user_config WHERE id = 1")
    row = cur.fetchone()
    return decrypt_config((row[0] if row else {}) or {})


def _load_active_template(cur) -> Optional[str]:
    cur.execute(
        """
        SELECT latex_source
          FROM cover_letter_templates
         WHERE is_active = true
         ORDER BY created_at DESC
         LIMIT 1
        """,
    )
    row = cur.fetchone()
    return row[0] if row else None


def _fetch_eligible_applications(cur, batch_size: int) -> List[Dict[str, Any]]:
    cur.execute(
        """
        SELECT a.id, j.title, j.company, rd.cover_emphasis
          FROM applications a
          JOIN jobs j ON j.id = a.job_id
          LEFT JOIN resume_diffs rd ON rd.application_id = a.id
         WHERE a.resume_pdf IS NOT NULL
           AND a.cover_letter_pdf IS NULL
         ORDER BY a.queued_at DESC NULLS LAST
         LIMIT %s
        """,
        (batch_size,),
    )
    return [
        {"id": r[0], "title": r[1], "company": r[2], "cover_emphasis": r[3] or ""}
        for r in cur.fetchall()
    ]


def _persist_cover(conn, app_id: int, tex: str, pdf_bytes: bytes) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE applications
               SET cover_letter_latex = %s,
                   cover_letter_pdf = %s
             WHERE id = %s
            """,
            (tex, psycopg2.Binary(pdf_bytes), app_id),
        )
    conn.commit()


# ────────────────────────────────────────────────────────────────────────────
# Runner entry point
# ────────────────────────────────────────────────────────────────────────────


def run(payload: Dict[str, Any]) -> Dict[str, Any]:
    db_url = payload.get("db_url") or os.environ.get("DATABASE_URL")
    if not db_url:
        return {"generated": 0, "failed": 0, "errors": ["db_url missing"]}

    batch_size = max(1, min(int(payload.get("batch_size", 5)), 20))
    tone = str(payload.get("tone") or "professional")
    tone_description = _TONE_PROMPTS.get(tone, _TONE_PROMPTS["professional"])

    errors: List[str] = []
    generated = 0
    failed = 0

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
                "errors": ["LLM endpoint/api_key not configured in user_config"],
            }

        template = _load_active_template(cur)
        if template is None:
            cur.close()
            return {
                "generated": 0,
                "failed": 0,
                "errors": ["no active cover_letter_templates row — seed one via the Settings UI"],
            }

        applications = _fetch_eligible_applications(cur, batch_size)
        cur.close()

        for app in applications:
            try:
                user_prompt = _USER_PROMPT_TEMPLATE.format(
                    title=app["title"],
                    company=app["company"],
                    cover_emphasis=(app["cover_emphasis"] or "(no emphasis provided — emphasize general fit)"),
                    tone_description=tone_description,
                )
                headers, body_json = _build_llm_request(cfg, user_prompt)
                data = _call_llm(endpoint, headers, body_json)
                body_text = _extract_text(data)
            except urllib.error.HTTPError as exc:
                failed += 1
                errors.append(f"app {app['id']}: LLM HTTP {exc.code}")
                continue
            except Exception as exc:  # noqa: BLE001
                failed += 1
                errors.append(f"app {app['id']}: llm call: {exc}")
                continue

            try:
                tailored_tex = _fill_template(template, app["company"], app["title"], body_text)
                pdf_bytes = _compile_pdf(tailored_tex)
            except Exception as exc:  # noqa: BLE001
                failed += 1
                errors.append(f"app {app['id']}: compile: {exc}")
                continue

            try:
                _persist_cover(conn, app["id"], tailored_tex, pdf_bytes)
                generated += 1
                print(f"cover-letter: app #{app['id']} cover compiled", file=sys.stderr)
            except Exception as exc:  # noqa: BLE001
                failed += 1
                errors.append(f"app {app['id']}: persist: {exc}")
                conn.rollback()

    finally:
        conn.close()

    return {"generated": generated, "failed": failed, "errors": errors}


if __name__ == "__main__":
    raw = sys.argv[1] if len(sys.argv) > 1 else "{}"
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        payload = {}
    result = run(payload)
    print(json.dumps(result))
