# Notiapply

Job application automation. Finds jobs, tailors resumes, fills ATS forms, tracks outreach.

- **n8n pipeline** scrapes jobs on a 6h cron (LinkedIn, Greenhouse/Lever/Ashby, GitHub, Wellfound).
- **Next.js + Tauri desktop app** (`app/`) renders a Kanban board; users review, queue, and trigger form-fill.
- **Playwright sidecar** (`sidecar/`) opens a browser, uploads the resume PDF, and fills ATS fields.
- **CRM board** tracks outreach contacts and drafted LinkedIn/email replies.

## Repo layout

| Path | Role |
|------|------|
| `app/` | Tauri desktop UI (Next.js static export). Queries PostgreSQL via `app/lib/db/`. |
| `sidecar/` | Node/Playwright automation. Entry point: `fill.js`. |
| `server/scraper/` | Python scrapers invoked by the runner service. |
| `server/runner/` | FastAPI HTTP dispatcher called by n8n to run scraper modules. |
| `deploy/docker/` | Compose stack: postgres + n8n + runner. |
| `migrations/` | Numbered SQL files, applied in filename order. |
| `docs/` | Architecture, setup, style, and testing guides. |

## Quickstart

Full instructions live in [docs/SETUP.md](docs/SETUP.md). Minimal path:

```bash
cd deploy/docker && docker compose up -d && ./migrate.sh   # backend
cd app && npm install && npm run dev                        # frontend
```

Copy `.env.example` → `.env` at the repo root and fill in `DATABASE_URL` (and `ENCRYPTION_KEY` if you want encrypted config storage).

## Architecture

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) has the full diagram, tier breakdown, and data-flow details. Summary:

1. n8n cron → HTTP → `runner` container → Python script in `server/scraper/` → PostgreSQL.
2. Tauri app reads the same PostgreSQL via `app/lib/db/` (barrel at `db/index.ts`).
3. User triggers the sidecar from the UI; sidecar reads resume bytes from the DB and fills the ATS.

Style and testing conventions: [docs/STYLE.md](docs/STYLE.md), [docs/TESTING.md](docs/TESTING.md).

## Gotchas

Non-obvious behaviors in this codebase. These will bite you if missed.

### Never call `window.location.reload()` in board components
Tauri serves the app as a static export; full-page reloads break the renderer. Mutate state by invoking the `onXxxUpdated(newItem)` callback and merging the updated item in place.

### `BaseScraper.__init__` requires `scraper_key` as the 2nd positional arg
```python
super().__init__(db_url, 'my-scraper-key', use_stealth=False)
```
`extract_jobs()` is abstract on `BaseScraper` — every subclass must implement it, even contact-only scrapers. Return `[]` for a no-op.

### DB access uses `getPool()`, not a `db` object
```typescript
const { rows } = await getPool().query('SELECT ...', [params]);
```
There is no default `db` export. The `{ db }` pattern will throw at runtime.

### Valid `JobState` values
Defined in `app/lib/types/job.ts`: `discovered`, `filtered-out`, `filtered`, `docs-failed`, `queued`, `filling`, `fill-failed`, `review-incomplete`, `review-ready`, `submitted`, `rejected`, `tracking`. Initial state on insert is `discovered`. `new` does not exist.

### `bypassCaptchaWithStealth()` must run before `page.goto()`
`page.addInitScript()` only injects into future navigations; calling it after a CAPTCHA appears has no effect on the current page.

### `user_config` has a JSONB `config` column *and* direct columns
`getUserConfig()` reads the JSONB `config` column only. Direct columns (e.g. `browser_agent_enabled`) must be SELECTed/UPDATEd explicitly — they won't appear on the returned config object.

### `ContactSchema.linkedin_url` validates as a strict URL
Relative paths like `/in/username` fail Zod `.parse()`. Use `.safeParse()` at ingest boundaries where source data quality is uncertain.

### `audit_db.py` reads from `pipeline_modules`
There is no `module_config` table; module configs live in a JSONB column on `pipeline_modules`.

### GitHub scraper `blog` is not LinkedIn
`user_data.get("blog")` from the GitHub API is the user's arbitrary website. Only assign it to `linkedin_url` if it contains `linkedin.com/in/`. Non-LinkedIn URLs belong in `contacts.personal_url` (migration `20260423000000`), which is the source the `enrich-contacts` module reads.

### `SENSITIVE_CFG_FIELDS` must stay in sync across Python + TypeScript
Two files list the secret-fields set that the frontend encrypts at write time (`app/lib/secure-config.ts:SENSITIVE_FIELDS`) and the backend decrypts at read time (`server/scraper/crypto_helper.py:SENSITIVE_CFG_FIELDS`). If you add a new secret in one place, add it in the other — otherwise the frontend encrypts a value the backend then reads as ciphertext and sends as a Bearer token (401 silent). The drift-guard test in `server/tests/test_crypto_wiring.py::TestDecryptConfig::test_sensitive_field_list_matches_frontend_expectations` asserts the two sets match.

### `apply_diff.py` uses **exact substring match** for bullet rewrites
`diff.bullets_swapped[].remove` must be an exact substring of the master LaTeX. An LLM hallucinating slightly-different bullet text (extra whitespace, different punctuation, a missing comma) produces a silent no-op — `result.replace(remove_text, add_text, 1)` simply finds no match. Validate LLM output against the master before committing to a diff, or prefer block-level `blocks_to_keep` rewrites which are index-based rather than substring-based.

### Mock data is intentionally minimal
`app/lib/mock-data.ts` is one-record-per-visible-surface on purpose. Before adding a new fixture, check whether an existing one already exercises the same code path. If you must add, delete another first. Exhaustive state coverage belongs in unit tests via `makeJob` / `makeContact` factories (`app/lib/test-fixtures.ts`), not in the preview-mode fixtures.

### LLM layer requires an OpenAI-compatible endpoint
Both the frontend (`app/lib/llm.ts`) and Python scrapers (`doc_generation.py`, `cover_letter.py`, `outreach_drafting.py`, `enrich_contacts.py`) send OpenAI `/v1/chat/completions`-shaped requests. `extractMessage` has a Gemini-native `candidates[0].content.parts[0].text` fallback for users hitting `generativelanguage.googleapis.com` directly, but new provider integrations MUST expose an OpenAI-compatible surface. Native Anthropic users route through OpenRouter or LiteLLM. Do not re-introduce a `llm_provider` switch — the config only has `llm_endpoint`, `llm_api_key`, `llm_model`.

### Notifications are client-side via the browser API, not ntfy
`app/lib/notifications.ts::sendPipelineNotification` uses the browser `Notification` API which Tauri's webview proxies to the OS natively (no `@tauri-apps/plugin-notification` install needed). First call triggers the OS permission prompt. Gated on `user_config.notifications_enabled` (default true). Wired into `JobsBoard.handleStartSession`'s `done` event. There is no longer a `ntfy_topic` field or server-side `notifications` pipeline module — do not re-add them.

### Scrapers live in `user_config.scrapers_enabled`, not `pipeline_modules`
The `pipeline_modules` table is reserved for processors with non-trivial per-module config (filter, enrich, doc-gen, cover-letter, outreach-drafting, liveness-check, extract-job-contacts, gmail-watch). Scrapers (`jobspy`, `ats-direct`, `github`, `wellfound`, `outreach-yc`, `outreach-github`) are a flat array in `user_config.config.scrapers_enabled`. n8n workflows must read that JSONB array before dispatching `/run/scrape-<key>` to the runner. Do not add new scraper rows to `pipeline_modules` — add the key to `SCRAPER_KEYS` in `app/lib/types/common.ts` and the Sources section in SettingsPage picks it up automatically.
