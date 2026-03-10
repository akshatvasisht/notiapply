# Coding Standards and Style Guide

This project spans multiple languages (TypeScript, Python, Rust). Strict adherence to native idioms ensures stability across the IPC boundaries.

## TypeScript (Next.js Application & Sidecar)

### Strict Types
The database schema acts as the ultimate unyielding truth. All TypeScript interfaces map 1:1 with the defined Postgres tables. 
- Avoid `any` under all circumstances. Use `unknown` or define an exhaustive literal union if the data shape is inherently dynamic (e.g. the pipeline config schema).
- Shared domain models reside entirely in `app/lib/types.ts`.

### React Paradigms
- **State Integrity**: Notiapply relies heavily on complex `useEffect` state syncing. Ensure dependency arrays are exhaustive.
- **CSS**: Tailwind v4 using `@theme` syntax in `globals.css`. Do not write arbitrary inline hex codes in React components. Stick to the strictly defined `--color-google-blue`, `--color-surface-raised`, etc., to preserve light/dark mode parity without media queries.

### Component Isolation
- Forms in the `SetupWizard` and `SettingsPage` must be entirely self-contained, propagating generic `onChange` and `onTest` handler payloads upwards, rather than deeply nesting the parent state pointer.

## Python (Scraping Fleet)

### Execution Model
The python scrapers operate entirely independent of the desktop application. They must gracefully fail standard I/O pipes.
- **Stateless Operation**: Scrapers load their instructions purely via JSON payload strings passed through `sys.argv`. State is mutated directly to the PostgreSQL database via `psycopg2`. No intermediate `.env` file reading should occur inside a scraper instance.
- **Error Bounds**: Exhaustive `try/except` captures. If an ATS scraper (Tier 2) fails to map a specific company's slug, it must soft-fail and log, allowing the loop to continue to the next target without crashing the orchestrator phase.

## Rust (Tauri Main Process)

### Inter-Process Communication (IPC)
The Tauri core acts exclusively as a secure orchestrator handling OS-level constraints that the embedded Webview forbids.
- Commands implemented in `app/src-tauri/src/lib.rs` must immediately return `Result<T, String>` to map gracefully to the `catch` blocks of the React frontend.
- When spawning the `fill.js` Node sidecar, the stream is captured line-by-line decoding standard `NDJSON` objects. Any lines not mapping to the registered `SidecarEvent` structs must be forwarded safely to STDERR without interrupting the pipe.

## Database Management

- Schema alterations must be explicitly tracked using deterministic `dbmate` migration files located in `migrations/`.
- Never execute arbitrary `ALTER` statements against the production DB.
- Use atomic `pg` transactions whenever executing state changes involving external LLM or sidecar events to prevent dangling "running" states if an asynchronous boundary abruptly terminates.
