# Notiapply: Testing Guide

This document outlines the testing strategy, standards, and execution procedures for the Notiapply project.

## Testing Strategy

Notiapply employs a multi-layered testing strategy to ensure reliability across the TypeScript frontend, Rust backend, and Playwright sidecar:

1.  **Unit Tests (Vitest)**: Fast, isolated tests for utility functions and business logic.
2.  **Component Tests (React Testing Library)**: Validating UI behavior, form state, and rendering in a JSDOM environment.
3.  **Integration Tests (Manual/Sidecar)**: Verification of the data flow between the Tauri process, the sidecar, and the PostgreSQL database.
4.  **End-to-End Tests (Playwright)**: Browser-level automation that validates critical user paths like the Setup Wizard and the Job Board.

## Quick Start

### Frontend Unit & Component Tests
Executed via Vitest. These run in a JSDOM environment and do not require the Tauri runtime or a database.

```bash
cd app
npm run test
```

### End-to-End Tests
Executed via Playwright. These require a running dev server.

```bash
cd app
npx playwright test
```

### Rust Backend Tests
Executed via Cargo. Validates internal Rust logic in the Tauri main process.

```bash
cd app/src-tauri
cargo test
```

### Python Server Logic
Validates the resume tailoring engine and scraper data schemas.

```bash
# Verify resume tailoring logic
python3 server/tests/test_apply_diff_logic.py

# Verify scraper schema validation
python3 server/tests/test_pydantic_schemas.py
```

## Environment Setup

### Mock Data Mode (Local Development)
For UI-centric development and testing, Notiapply includes a built-in Mock Mode. If the application handles a database connection failure, it automatically falls back to static data defined in `app/lib/mock-data.ts`.

To run with mock data:
1. Ensure no PostgreSQL service is running on Port 5432.
2. Run `npm run dev`.

### Local Integration Environment
To test the full persistent pipeline, a local PostgreSQL instance is required.

1. **Initialize Database**:
   ```bash
   # Using dbmate for migrations
   DATABASE_URL="postgresql://user:pass@localhost:5432/notiapply" dbmate up
   ```
2. **Configure Environment**:
   Create `app/.env.local` pointing to your local instance.

## Standards and Conventions

### Test File Naming
- **Unit/Component**: `*.test.ts` or `*.test.tsx` colocated with the source file.
- **E2E**: `tests/e2e/*.spec.ts`.

### Mocking Philosophy
- **Tauri Commands**: All `invoke` calls should be mocked using `vi.mock('@tauri-apps/api')` to allow tests to run outside the Tauri environment.
- **Database Layer**: Data fetching logic in `@/lib/db` should be mocked in component tests to ensure UI responsiveness tests aren't blocked by DB I/O.
- **Sidecar**: The Playwright sidecar is treated as a separate service; its interactions are tested through smoke tests that verify the NDJSON stream format.

### Continuous Integration
The test suite is designed to be CI-ready:
- **Headless Mode**: Playwright tests run in headless mode by default for automated environments.
- **Static Assets**: Build verification ensures the Next.js static export correctly bundles with the Tauri binary.

## Manual Integration Checklist
Before every release, the following manual checks are performed to validate parts of the system that are difficult to automate (e.g., native file dialogs, sidecar IPC):

1. **Setup Wizard**: Verify `.tex` file upload and LLM key validation.
2. **Live Scrape**: Trigger an n8n pipeline run and verify jobs appear in "Incoming".
3. **Fill Session**: Verify that `startFillSession` correctly spawns the Playwright sidecar.
4. **Focus Mode**: Ensure the PDF preview renders correctly for generated resumes.

## Troubleshooting

### "DATABASE_URL not set"
Ensure your `.env.local` is present in the `app/` directory and contains a valid connection string.

### "Tauri commands not available"
If testing native features (notifications, shell commands), you must run the application via `npm run tauri dev` rather than the standard browser-only dev server.
