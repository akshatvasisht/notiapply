# Notiapply Architecture

This document details the architectural layout, core components, and data lifecycle of Notiapply, an autonomous job application system. Notiapply operates as a coordinated monorepo combining a Tauri-based desktop application, a headless automated browser sidecar, a Python scraping fleet, and a PostgreSQL database.


## Glossary of Terms

- **Master Resume**: A single-column LaTeX file containing a `% SKILLS_INJECT_POINT` marker, used as the base template for all generated applications.
- **Sidecar**: The `fill.js` Node process. Spawned deterministically by the Tauri backend to handle the interactive DOM execution required for complex ATS form submissions.
- **Scraper Tiers**: The four levels of data extraction utilized by the backend fleet.
  - **Tier 1**: Aggregator polling (JobSpy).
  - **Tier 2**: Direct ATS JSON ingest (Greenhouse, Lever, Ashby).
  - **Tier 3**: GitHub Markdown table parsing.
  - **Tier 4**: Complex JS-rendered state blobs (Wellfound via CF-Clearance).
- **Scrapling + Camoufox**: The browser-fingerprint spoofing layer used by Tier 4 (Wellfound) to transparently bypass Cloudflare without a proxy or paid service.
- **n8n Orchestrator**: The workflow engine responsible for handling incoming webhook triggers, executing the Python scrapers, and inserting structured results into the Postgres database.

---

## Technology Stack

| **Category** | **Technology** | **Purpose** | **Rationale** |
|---|---|---|---|
| **Frontend Framework** | **React (Next.js 16)** | Desktop UI (Kanban Board, Setup Wizard, Settings) | Statically exported (SSG) for performance inside Tauri. |
| **Desktop Shell** | **Tauri 2.0** | Main application window, IPC coordination | Uses native OS webviews (WebKit/Edge) instead of bundling Chromium. |
| **Automation Sidecar** | **Playwright (Node)** | Headless/Headed ATS form execution | Deterministic shadow-DOM traversal and frame handling. |
| **Database** | **PostgreSQL** | Relational data persistence | Handles deep JSONB storage for company schemas and workflow states. |
| **Scraping** | **Python 3.10+** | Multi-tier job aggregation | Leverages `jobspy`, `scrapling`, and `instructor` for typed extraction. |
| **Orchestration** | **n8n** | Pipeline execution | Visual workflow management decoupled from the UI. |
| **Typesetting** | **Tectonic** | Resume/Cover Letter PDF compilation | Self-contained LaTeX engine without a massive TeX Live installation. |

## Proxy-Free Design

Notiapply is explicitly engineered to operate without any paid proxy service:

- **Tier 1 (JobSpy)**: LinkedIn, Indeed, Glassdoor, and ZipRecruiter are scraped at the request rate of a single job-seeker. These volumes are several orders of magnitude below what triggers IP bans, which target bulk commercial scrapers.
- **Tier 4 (Wellfound)**: Uses **Scrapling + Camoufox**: a fingerprint-spoofing browser that presents as a legitimate, randomized user agent and TLS profile. Cloudflare cannot distinguish it from a real user, so no residential proxy IP rotation is required.
- **Tier 2 (ATS Direct)**: Greenhouse, Lever, and Ashby expose public JSON API endpoints designed to be consumed by job boards. No anti-scraping measures apply.
- **Tier 3 (GitHub)**: Raw GitHub API with a personal access token. Rate limit is 5,000 req/hour, which is far above what the pipeline consumes.

> Residential proxy services like Decodo cost $2–15/GB and shift IP risk to a third party. The above stack eliminates this dependency entirely through smarter tooling choices.

## Unified Monorepo Architecture

Notiapply maps entirely to a local execution environment or a self-hosted instance (e.g., Oracle ARM free-tier). 

### Core Components

**1. The Tauri UI (`app/`)**
- A React application acting as the user's mission control.
- Directly polls the user's PostgreSQL database to populate the 5-column Kanban board.
- Handles configuration editing (API keys, tag mapping, ATS watchlist).
- Exposes a `start_fill_session` Tauri command to invoke the NodeJS sidecar.

**2. The Playwright Sidecar (`sidecar/`)**
- A transient Node script (`fill.js`) invoked with a target Job ID.
- Communicates back to the Tauri main process exclusively via an NDJSON stdout stream.
- Uploads the parsed Resume PDF, attempts semantic field mapping, and halts for user review.
- Operates on a strict "one job per invocation" model to guarantee runtime isolation.

**3. The Python Fleet (`server/`)**
- Four independent python scripts that connect out to varying data sources.
- Operates statelessly; invoked by the n8n orchestrator via standard shell commands.
- `apply_diff.py` acts as the document mutation engine, combining LLM-generated bullet injections with the Master Resume template.

**4. The PostgreSQL Database**
- The absolute source of truth.
- `jobs` table maintains deduplicated listings.
- `user_config` holds the LLM, notification, and credential state.
- `pipeline_modules` holds dynamic JSON Schema definitions for extensible n8n scraping nodes.

## Data Flow

### The Pipeline Lifecycle

**Phase 1: Discovery**
1. The n8n orchestrator runs a cron trigger (or is manually invoked via the UI).
2. It executes the Python Tier 1-4 scrapers.
3. The scrapers generate deduplicated hashes based on `title + company + location` and insert new rows into the `jobs` table with a state of `incoming`.

**Phase 2: LLM Mutation**
1. A secondary n8n workflow detects the `incoming` job.
2. It hits the Gemini LLM endpoint with the job description and the user's master resume.
3. The LLM selects high-relevance experience/project blocks using `% <BLOCK:Name>` tags and generates a tailored diff for the remaining content.
4. `apply_diff.py` performs block-level truncation, modifies the LaTeX template, and compiles the new `resume_{job_id}.pdf`.
5. The job state advances to `ready`.

### Tailoring Methodology

Notiapply uses two distinct rigor models for application documents:

- **Resume Tailoring (Subtractive Rigor)**: The engine treats the master resume as a superset. It uses block-level truncation to remove projects or experiences that don't fit the specific job's relevance or page-count constraints. This ensures every bullet point is derived from your verified history while optimizing for spatial constraints.
- **Cover Letter Generation (Additive Rigor)**: Unlike the resume, the cover letter is purely generative. It uses the `{{BODY}}` tag as its primary anchor, constructing a unique prose narrative that bridges the gap between your master history and the job requirements. This methodology focuses on semantic alignment and storytelling rather than spatial filtering.

**Phase 3: Automated Submission**
1. The user clicks "Start Session" in the Tauri UI.
2. The Tauri shell spawns the `fill.js` sidecar.
3. The sidecar dynamically fills the ATS form.
4. If successful, the sidecar marks the job as `submitted` in Postgres.
5. If an anomaly is hit (unknown schema, CAPTCHA), it marks it as `attention` and gracefully exits.

## Design Decisions

### UI-Decoupled Scraping
The heavy lifting (discovery and document generation) is physically decoupled from the React UI. A user can run the `bootstrap.sh` script on a remote Oracle instance, allowing the n8n orchestrator to scrape 24/7. When the user opens the desktop app, their queue is already populated.

### Playwright via Sidecar
Instead of wrestling with WebKit limits inside Tauri, automation is distinctly offloaded to a Node sidecar running full Chromium. The NDJSON interface ensures the Tauri app never blocks its main thread on a hung DOM element, and if Chromium crashes, the UI remains perfectly stable.

### Static Export Next.js
The UI avoids all SSR/Node features of Next.js, compiling down to raw static HTML/JS/CSS via `output: 'export'`. This allows the Tauri rust binary to serve the frontend purely from memory, keeping the footprint microscopic compared to an Electron equivalent.

## User Interface Reference

### Keyboard Shortcuts

The application supports comprehensive keyboard navigation for power users:

**Global Shortcuts**
- `?` - Show keyboard shortcuts help modal
- `Ctrl+F` - Focus search input
- `Esc` - Progressive dismiss (shortcuts → selection → focus → view)

**Navigation**
- `Arrow Keys` - Navigate between job cards within columns
- `Enter` - Open focused job in detail view
- `1-5` - Jump to specific board columns (Incoming/Ready/Attention/Submitted/Archive)
- `Tab` - Standard focus cycling through interactive elements

**Actions**
- `A` - Archive selected job(s)
- `S` - Mark job(s) as submitted
- `R` - Reject/remove job(s) from pipeline
- `Ctrl+A` - Select all visible jobs (respects active search filter)

**Multi-Select Mode**
- `Ctrl+Click` - Toggle individual job selection
- `Shift+Click` - Select range of jobs

### Search and Filtering

The global search bar filters jobs client-side across:
- Job title
- Company name
- Location

Search is case-insensitive and updates results in real-time. The filter persists across view changes but resets on refresh.

### Multi-Select Workflow

1. `Ctrl+Click` individual job cards to select multiple
2. Selected cards display with primary color background and border
3. Selection count appears in topnav, replacing queue count
4. Use "Clear" button or `Esc` to deselect all
5. Bulk actions apply to all selected jobs simultaneously

### Toast Notifications

Non-blocking feedback appears bottom-right for:
- Success operations (green)
- Error conditions (red)
- Warnings (yellow)
- Informational messages (blue)

Toasts auto-dismiss after 3 seconds or can be manually dismissed.


## CRM & Contacts

### Contacts Board

The Contacts Board is a supplementary Kanban interface for managing networking relationships alongside the job pipeline. It mirrors the Jobs Board layout while adding contact-specific states.

**Contact States:**
- **identified** → **drafted** → **contacted** → **replied** → **interviewing** → **rejected/closed**

### Message Drafting

The app can pre-fill personalized outreach drafts using the configured LLM endpoint:

- Pulls context from the contact's role, company, and any enrichment data available
- Generates a short (< 150 words) draft that the user reviews and sends manually
- Tone is configurable: professional / casual / enthusiastic
- Rate-limited to 500ms between requests to avoid API throttling

All sending is manual: the app never sends messages automatically.

### Smart Archiving

To handle high-volume pipelines, columns use initial pagination:

- **Default display:** 20 cards per column
- **"Show More"** expands to full list on demand
- **Auto-archive:** Jobs older than N months transition to Archive on state change
- Search always indexes the full, unpaginated dataset

### View Toggle

The top navigation bar includes a segmented control to switch between the Jobs Pipeline and Contacts views. State is not shared between views, so each board loads independently.

