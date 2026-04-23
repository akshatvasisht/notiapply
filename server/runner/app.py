"""FastAPI runner that dispatches scraper scripts as subprocesses for n8n."""

import hmac
import json
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field


WEBHOOK_SECRET = os.environ.get("NOTIAPPLY_WEBHOOK_SECRET")
if not WEBHOOK_SECRET:
    raise RuntimeError("NOTIAPPLY_WEBHOOK_SECRET env var is required")

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL env var is required")

SERVER_ROOT = Path("/app/server")

SCRIPT_MAP: Dict[str, str] = {
    "scrape-jobspy": "scraper/jobspy_run.py",
    "scrape-ats-direct": "scraper/ats_direct.py",
    "scrape-github": "scraper/github_poll.py",
    "scrape-wellfound": "scraper/wellfound.py",
    "scrape-outreach-github": "scraper/leads/outreach_github.py",
    "scrape-outreach-yc": "scraper/leads/outreach_yc.py",
    "liveness-check": "scraper/liveness_check.py",
    "extract-job-contacts": "scraper/leads/job_contact_extractor.py",
    "filter": "scraper/filter.py",
    "outreach-drafting": "scraper/outreach_drafting.py",
    "notifications": "scraper/notifications.py",
}


class RunRequest(BaseModel):
    module_config: Dict[str, Any] = Field(default_factory=dict)
    timeout_seconds: int = 600


class RunResponse(BaseModel):
    module_key: str
    exit_code: int
    result: Optional[Dict[str, Any]] = None
    stdout_tail: str = ""
    stderr_tail: str = ""


app = FastAPI(title="notiapply-runner")


def _tail(text: str, limit: int = 4000) -> str:
    if text is None:
        return ""
    return text[-limit:] if len(text) > limit else text


def _parse_last_json_object(stdout: str) -> Optional[Dict[str, Any]]:
    for line in reversed(stdout.splitlines()):
        stripped = line.strip()
        if stripped.startswith("{") and stripped.endswith("}"):
            try:
                parsed = json.loads(stripped)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                continue
    return None


@app.get("/healthz")
def healthz() -> Dict[str, Any]:
    return {"status": "ok", "keys": sorted(SCRIPT_MAP.keys())}


@app.post("/run/{module_key}", response_model=RunResponse)
def run_module(
    module_key: str,
    body: RunRequest,
    x_webhook_secret: Optional[str] = Header(default=None, alias="X-Webhook-Secret"),
) -> RunResponse:
    if not x_webhook_secret or not hmac.compare_digest(x_webhook_secret, WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="invalid or missing webhook secret")

    if module_key not in SCRIPT_MAP:
        raise HTTPException(status_code=404, detail=f"unknown module_key: {module_key}")

    script_rel = SCRIPT_MAP[module_key]
    script_abs = SERVER_ROOT / script_rel
    if not script_abs.is_file():
        raise HTTPException(status_code=500, detail=f"script file missing: {script_rel}")

    payload: Dict[str, Any] = {**(body.module_config or {}), "db_url": DATABASE_URL}
    payload_str = json.dumps(payload)

    env = os.environ.copy()
    existing_pp = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = (
        f"{SERVER_ROOT}:{existing_pp}" if existing_pp else str(SERVER_ROOT)
    )

    try:
        completed = subprocess.run(
            ["python", str(script_abs), payload_str],
            cwd=str(SERVER_ROOT),
            env=env,
            capture_output=True,
            text=True,
            timeout=body.timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        stdout_tail = _tail(exc.stdout.decode("utf-8", errors="replace") if isinstance(exc.stdout, (bytes, bytearray)) else (exc.stdout or ""))
        stderr_tail = _tail(exc.stderr.decode("utf-8", errors="replace") if isinstance(exc.stderr, (bytes, bytearray)) else (exc.stderr or ""))
        raise HTTPException(
            status_code=504,
            detail={
                "module_key": module_key,
                "error": "subprocess timeout",
                "timeout_seconds": body.timeout_seconds,
                "stdout_tail": stdout_tail,
                "stderr_tail": stderr_tail,
            },
        )

    result = _parse_last_json_object(completed.stdout or "")

    return RunResponse(
        module_key=module_key,
        exit_code=completed.returncode,
        result=result,
        stdout_tail=_tail(completed.stdout or ""),
        stderr_tail=_tail(completed.stderr or ""),
    )
