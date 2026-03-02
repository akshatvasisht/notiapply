# Testing Notiapply

Notiapply employs a comprehensive testing strategy spanning unit tests, component boundary testing, and Playwright automation checks. As an autonomous desktop application handling sensitive browser execution, deterministic testing is strictly enforced.

---

## 1. Test Architecture

The primary testing stack for the `app/` (Tauri + React) domain is **Vitest** paired with **React Testing Library**.
Vitest provides native ESM and TypeScript support without the latency of transpilation, making it ideal for the Next.js execution environment.

### Tooling
- **Test Runner**: Vitest
- **DOM Assertions**: `@testing-library/jest-dom`
- **Environment**: `jsdom`

---

## 2. Running Tests

All frontend testing is isolated within the `app/` directory.

```bash
cd app
npm run test
```

### Coverage
To run tests with an coverage report:
```bash
npm run test -- --coverage
```

---

## 3. Test Suites

### Unit Tests (`*.test.ts`)
Utility functions and decoupled logic must be fully covered.
- Example: `app/lib/utils.test.ts` thoroughly tests edge cases for `timeAgo` (including negative/future timestamps) and `formatSalary` (null combinations).

### Component Tests (`*.test.tsx`)
React components are tested via behavioral boundaries (how they render and what callbacks they trigger), *not* internal state.
- Focus on `data-testid` or accessibility labels when selecting elements.
- Example: `JsonSchemaForm.test.tsx` validates that the correct HTML representations (checkboxes, select dropdowns) map to the injected JSON Schema types, and that the `onChange` event bubbles correctly.

### Database Abstraction Isolation
The database query layer (`app/lib/db.ts`) exposes parameterized connection string injection (`initPool`). During tests, **never** allow the system to default to the environment `DATABASE_URL`. If testing DB queries directly, supply a bespoke `postgres://` connection mapped to a disposable test container.

---

## 4. Sidecar Automation Testing (Python / Node)

The automated filling engine (`sidecar/fill.js`) and Python scraping fleet operate outside the Tauri test boundary.

- **Scrapers (Python)**: Unit tests for the HTML/JSON parsers reside in `server/tests/`. Scraper integration tests should hit static HTTP mocks (via `responses`), not live production ATS URLs, to prevent IP bans.
- **Sidecar (Playwright)**: When modifying `fill.js`, utilize Playwright's native headed mode for testing (`chromium.launch({ headless: false })`) against a local HTML form mock before deploying to Tauri's NDJSON IPC.
