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
`user_data.get("blog")` from the GitHub API is the user's arbitrary website. Only assign it to `linkedin_url` if it contains `linkedin.com/in/`.
