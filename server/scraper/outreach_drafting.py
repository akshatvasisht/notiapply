#!/usr/bin/env python3
"""Outreach drafting module: batch-generate draft cold-outreach messages via LLM.

Selects contacts without a drafted_message, applies role-classified strategy
templates (recruiter / hiring_manager / peer / generic — ported from
app/lib/llm.ts so batched pipeline runs hit the same prompt contract the
frontend uses on-demand), calls the configured LLM endpoint, writes to
contacts.drafted_message.

Soft-fails per contact so one bad row doesn't stop the batch.
"""

import json
import re
import sys
import urllib.error
import urllib.request

import psycopg2

from scraper.crypto_helper import decrypt_config
from scraper.db_connect import get_db_url


_RECRUITER_RE = re.compile(r"recruit|talent|sourcer", re.IGNORECASE)
_HIRING_MGR_RE = re.compile(r"hiring.manager|director|vp|head.of|chief|cto|ceo|founder", re.IGNORECASE)
_PEER_RE = re.compile(r"engineer|developer|designer|product manager|analyst|scientist", re.IGNORECASE)

_SYSTEM_PROMPT = (
    "You are an expert at crafting ultra-concise, high-conversion cold outreach "
    "messages for LinkedIn and email. Your messages follow a 3-sentence formula "
    "adapted to the recipient type: for recruiters use Hook -> Role Fit -> Resume "
    "CTA; for hiring managers use Interest Hook -> Achievement -> Challenge "
    "Question; for peer engineers/designers use Shared Interest -> Problem -> "
    "Soft Connection (NO job ask for peers). Keep it under 60 words, direct, "
    "and genuine. No fluff or formalities."
)


def _classify(role: str | None) -> str:
    if not role:
        return "generic"
    if _RECRUITER_RE.search(role):
        return "recruiter"
    if _HIRING_MGR_RE.search(role):
        return "hiring_manager"
    if _PEER_RE.search(role):
        return "peer"
    return "generic"


def _sanitize(text: str | None, limit: int = 200) -> str:
    if not text:
        return ""
    clean = re.sub(r"IGNORE|DISREGARD|OVERRIDE|SYSTEM:|ASSISTANT:", "", str(text), flags=re.IGNORECASE)
    clean = clean.replace("\n", " ").replace("\r", "")
    return clean[:limit].strip()


def _build_prompt(contact: dict, tone: str) -> str:
    name = _sanitize(contact.get("name"))
    role = _sanitize(contact.get("role"))
    company = _sanitize(contact.get("company_name"))
    job_title = _sanitize(contact.get("job_title"))
    industry = _sanitize(contact.get("company_industry"))
    tone_safe = _sanitize(tone)
    strategy = _classify(contact.get("role"))

    parts = [f"Write a concise LinkedIn/cold outreach message to {name}"]
    if role:
        parts.append(f"who is a {role}")
    parts.append(f"at {company}.")
    if job_title:
        parts.append(f"\n\nContext: Reaching out about the {job_title} role at {company}.")
    if industry:
        parts.append(f"\nCompany: {company} ({industry} industry).")

    role_suffix = f" ({job_title})" if job_title else ""
    role_inline = f" for {job_title}" if job_title else ""

    templates = {
        "recruiter": (
            "\n\nFormat (3 sentences max -- recruiter strategy):\n"
            f"1. Opening: \"Hi {name}, I saw {company} is hiring{role_inline}.\"\n"
            "2. Fit: \"My [X] experience in [SKILL] maps directly to what you're looking for.\"\n"
            "3. CTA: \"Happy to share my resume if it's a fit!\"\n\n"
            "Requirements:\n- MAXIMUM 3 sentences (50-60 words total)\n"
            f"- Use contact's actual name ({name})\n"
            f"- Lead with the specific role{role_suffix}\n"
            "- Highlight 1-2 directly relevant skills\n- End with resume CTA\n"
            f"- {tone_safe} tone\n- NO placeholders like [Your Name] - leave unsigned\n"
            "- NO formality or fluff"
        ),
        "hiring_manager": (
            "\n\nFormat (3 sentences max -- hiring manager strategy):\n"
            f"1. Hook: \"Hi {name}, {company}'s work on [AREA] caught my attention.\"\n"
            "2. Value: \"I've been [RELEVANT ACHIEVEMENT] -- directly relevant to what your team is building.\"\n"
            "3. Question: \"Would love to hear how your team approaches [RELATED CHALLENGE]?\"\n\n"
            "Requirements:\n- MAXIMUM 3 sentences (50-60 words total)\n"
            f"- Use contact's actual name ({name})\n"
            "- Lead with genuine interest in company work, not job opening\n"
            "- Include one concrete achievement\n- End with a thoughtful question, not a resume ask\n"
            f"- {tone_safe} tone\n- NO placeholders like [Your Name] - leave unsigned"
        ),
        "peer": (
            "\n\nFormat (3 sentences max -- peer strategy -- NO JOB PITCH):\n"
            f"1. Hook: \"Hi {name}, I came across your [WORK/POST/PROJECT].\"\n"
            "2. Shared interest: \"I've been exploring similar problems around [AREA].\"\n"
            "3. Soft CTA: \"Would love to exchange notes sometime!\"\n\n"
            "CRITICAL RULES for peer strategy:\n- MAXIMUM 3 sentences (50-60 words total)\n"
            f"- Use contact's actual name ({name})\n"
            "- NEVER mention the job opening or that you're job searching\n"
            "- Frame entirely as professional connection and shared interests\n"
            "- End with soft \"exchange notes\" CTA, NOT \"discuss the role\"\n"
            f"- {tone_safe} tone\n- NO placeholders like [Your Name] - leave unsigned"
        ),
        "generic": (
            "\n\nFormat (3 sentences max):\n"
            f"1. Opening: \"Hi {name}, I saw {company} is hiring{role_inline}.\"\n"
            "2. Value prop: \"My experience in [SPECIFIC SKILL/AREA] would be a great fit.\"\n"
            "3. CTA: \"Would love to connect and discuss!\"\n\n"
            "Requirements:\n- MAXIMUM 3 sentences (50-60 words total)\n"
            f"- Use contact's actual name ({name})\n"
            f"- Reference the specific role{role_suffix}\n"
            "- Mention 1-2 specific relevant skills/experiences\n"
            "- End with simple CTA: \"Would love to connect and discuss!\"\n"
            f"- {tone_safe} tone\n- NO placeholders like [Your Name] - leave unsigned\n"
            "- NO formality or fluff - keep it direct and genuine"
        ),
    }
    parts.append(templates[strategy])
    return " ".join(parts)


def _build_request(prompt: str, cfg: dict) -> tuple[dict, dict]:
    """OpenAI-compatible chat-completions. See doc_generation._build_llm_request for rationale."""
    model = cfg.get("llm_model") or "gemini-1.5-flash"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {cfg.get('llm_api_key') or ''}",
    }
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 200,
        "temperature": 0.7,
    }
    return headers, body


def _extract_message(data: dict) -> str:
    return data["choices"][0]["message"]["content"].strip()


def _call_llm(endpoint: str, headers: dict, body: dict, timeout: int = 30) -> dict:
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run(db_url: str, module_config: dict):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute("SELECT config FROM user_config WHERE id = 1")
    row = cur.fetchone()
    cfg = decrypt_config((row[0] if row else {}) or {})

    endpoint = cfg.get("llm_endpoint")
    api_key = cfg.get("llm_api_key")
    if not endpoint or not api_key:
        cur.close()
        conn.close()
        return {"drafted": 0, "skipped": 0, "errors": ["LLM endpoint/api_key not configured"]}

    tone = cfg.get("crm_message_tone") or "professional"
    batch_size = int(module_config.get("batch_size", 25))

    cur.execute(
        """
        SELECT c.id, c.name, c.role, c.company_name, c.company_industry, j.title
          FROM contacts c
          LEFT JOIN jobs j ON j.id = c.job_id
         WHERE c.drafted_message IS NULL
           AND c.name IS NOT NULL
           AND c.company_name IS NOT NULL
         ORDER BY c.created_at DESC
         LIMIT %s
        """,
        (batch_size,),
    )
    rows = cur.fetchall()

    drafted = 0
    skipped = 0
    errors: list[str] = []

    for cid, name, role, company, industry, job_title in rows:
        try:
            prompt = _build_prompt(
                {
                    "name": name,
                    "role": role,
                    "company_name": company,
                    "company_industry": industry,
                    "job_title": job_title,
                },
                tone,
            )
            headers, body = _build_request(prompt, cfg)
            data = _call_llm(endpoint, headers, body)
            message = _extract_message(data)
            cur.execute(
                "UPDATE contacts SET drafted_message = %s, updated_at = NOW() "
                "WHERE id = %s AND drafted_message IS NULL",
                (message, cid),
            )
            if cur.rowcount > 0:
                drafted += 1
            else:
                skipped += 1
            conn.commit()
        except urllib.error.HTTPError as e:
            errors.append(f"contact_id={cid}: HTTP {e.code} {e.reason}")
            conn.rollback()
        except Exception as e:
            errors.append(f"contact_id={cid}: {e}")
            conn.rollback()

    cur.close()
    conn.close()
    return {"drafted": drafted, "skipped": skipped, "errors": errors}


if __name__ == "__main__":
    payload = json.loads(sys.argv[1] if len(sys.argv) > 1 else "{}")
    print(json.dumps(run(get_db_url(payload), payload)))
