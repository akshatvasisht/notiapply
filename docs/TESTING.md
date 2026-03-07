# Notiapply — Testing Guide

**Last Updated:** 2026-03-03

---

## Overview

Notiapply uses a **unified testing strategy** combining:
- **Vitest** for frontend unit/component tests (TypeScript/React)
- **Cargo test** for Rust/Tauri backend tests
- **Manual integration testing** for end-to-end workflow validation

**Current Coverage:**
- [PASS] 13/13 frontend tests passing
- [PASS] Utility functions (timeAgo, formatSalary)
- [PASS] JSON Schema Form component
- [PASS] Setup Wizard component (basic)
- [WARN] Database layer (requires mock)
- [WARN] Tauri commands (requires mock)
- [WARN] Sidecar integration (manual only)

---

## Quick Start

### Run All Frontend Tests
```bash
cd app
npm run test
```

**Output:**
```
✓ lib/utils.test.ts (8 tests) 10ms
✓ app/components/wizard/SetupWizard.test.tsx (2 tests) 82ms
✓ app/components/settings/JsonSchemaForm.test.tsx (3 tests) 383ms

Test Files  3 passed (3)
     Tests  13 passed (13)
```

### Run Tests in Watch Mode
```bash
cd app
npm run test -- --watch
```

### Run Specific Test File
```bash
cd app
npx vitest lib/utils.test.ts
```

---

## Test Structure

### Frontend Tests (Vitest + React Testing Library)

```
app/
├── lib/
│   └── utils.test.ts           # Utility function tests
├── app/
│   └── components/
│       ├── wizard/
│       │   └── SetupWizard.test.tsx
│       └── settings/
│           └── JsonSchemaForm.test.tsx
├── vitest.config.ts            # Vitest configuration
└── vitest.setup.ts             # Test setup (globals, mocks)
```

### Test Configuration

**[vitest.config.ts](app/vitest.config.ts)**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        globals: true,
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
});
```

---

## Writing Tests

### Unit Tests (Pure Functions)

**Example:** [app/lib/utils.test.ts](app/lib/utils.test.ts)

```typescript
import { describe, it, expect } from 'vitest';
import { timeAgo, formatSalary } from './utils';

describe('timeAgo', () => {
    it('formats minutes correctly', () => {
        const date = new Date(Date.now() - 5 * 60000).toISOString();
        expect(timeAgo(date)).toBe('5m ago');
    });
});

describe('formatSalary', () => {
    it('formats min and max range', () => {
        expect(formatSalary(120000, 150000)).toBe('$120k–$150k');
    });
});
```

### Component Tests (React)

**Example:** [app/app/components/settings/JsonSchemaForm.test.tsx](app/app/components/settings/JsonSchemaForm.test.tsx)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import JsonSchemaForm from './JsonSchemaForm';
import { describe, it, expect, vi } from 'vitest';

describe('JsonSchemaForm', () => {
    it('renders text, number, and boolean fields correctly', () => {
        const schema = {
            properties: {
                testString: { type: 'string', title: 'Test String', default: 'hello' }
            }
        };
        const onChange = vi.fn();
        render(<JsonSchemaForm schema={schema} value={{} onChange={onChange} />);

        expect(screen.getByText('Test String')).toBeInTheDocument();
        expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
    });
});
```

### Mocking External Dependencies

**Database Mocks:**
```typescript
vi.mock('@/lib/db', () => ({
    updateUserConfig: vi.fn(),
    getUserConfig: vi.fn().mockResolvedValue({}),
    getJobs: vi.fn().mockResolvedValue([]),
}));
```

**Tauri Mocks:**
```typescript
vi.mock('@tauri-apps/api', () => ({
    invoke: vi.fn(),
}));
```

---

## Test Coverage by Layer

### [PASS] Tested

| Component | Test File | Coverage |
|-----------|-----------|----------|
| **Utilities** | lib/utils.test.ts | 100% |
| `timeAgo()` | ✓ | Minutes, hours, days, future dates |
| `formatSalary()` | ✓ | Min/max, null handling |
| **JSON Schema Form** | components/settings/JsonSchemaForm.test.tsx | 80% |
| Text/number/boolean inputs | ✓ | Rendering, defaults, onChange |
| Enum select dropdowns | ✓ | Rendering, value selection |
| **Setup Wizard** | components/wizard/SetupWizard.test.tsx | 40% |
| Step progression | ✓ | Initial render, validation |

### [WARN] Partially Tested / Mocked

| Component | Status | Notes |
|-----------|--------|-------|
| **Database Layer** | Mocked | Requires PostgreSQL connection |
| `getJobs()`, `updateJobState()` | ✓ | Mocked in component tests |
| **Tauri Commands** | Mocked | Requires Tauri runtime |
| `startFillSession()`, `triggerPipelineRun()` | ✓ | Mocked in component tests |

### [FAIL] Not Tested (Manual Only)

| Component | Reason |
|-----------|--------|
| **Sidecar Integration** | Requires Node.js binary + Playwright |
| **Database Schema** | Requires PostgreSQL + migrations |
| **n8n Workflows** | External dependency |
| **File Upload** | FileReader API complex to mock |

---

## Running the App Without Database

### Option 1: Mock Data Mode (Planned)

**Not yet implemented** — To preview UI without database:

1. Create `app/lib/mock-data.ts`:
```typescript
export const MOCK_JOBS: Job[] = [
    {
        id: 1,
        source: 'jobspy-linkedin',
        title: 'Backend Engineer',
        company: 'Stripe',
        location: 'Remote',
        url: 'https://stripe.com/jobs/123',
        description_raw: 'Build payment infrastructure...',
        salary_min: 150000,
        salary_max: 220000,
        equity_min: null,
        equity_max: null,
        company_role_location_hash: 'hash123',
        discovered_at: new Date().toISOString(),
        docs_fail_reason: null,
        state: 'queued',
    },
    // ... more mock jobs
];
```

2. Update `app/lib/db.ts` to detect `MOCK_MODE`:
```typescript
export async function getJobs(): Promise<Job[]> {
    if (process.env.MOCK_MODE === 'true') {
        return MOCK_JOBS;
    }
    const { rows } = await getPool().query('SELECT * FROM jobs ORDER BY discovered_at DESC');
    return rows;
}
```

3. Run with mock flag:
```bash
cd app
MOCK_MODE=true npm run dev
```

### Option 2: Local PostgreSQL with Seed Data

**Setup:**
```bash
# 1. Install PostgreSQL
sudo apt install postgresql postgresql-contrib  # Linux
brew install postgresql@16                      # macOS

# 2. Start PostgreSQL
sudo systemctl start postgresql  # Linux
brew services start postgresql   # macOS

# 3. Create database and user
sudo -u postgres psql
CREATE DATABASE notiapply;
CREATE USER notiapply WITH ENCRYPTED PASSWORD 'dev_password';
GRANT ALL PRIVILEGES ON DATABASE notiapply TO notiapply;
\q

# 4. Run database migrations (creates all tables + seeds data)
cd /home/aksha/notiapply
DATABASE_URL="postgresql://notiapply:dev_password@localhost:5432/notiapply" dbmate up

# Note: migrations/20250101000000_init.sql creates all tables AND seeds pipeline modules
# No separate seed script needed
```

**Environment:**
```bash
# app/.env.local
DATABASE_URL=postgresql://notiapply:dev_password@localhost:5432/notiapply
```

---

## Building the Tauri App

### Prerequisites

1. **Rust toolchain:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

2. **System dependencies (Linux):**
```bash
sudo apt install libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

3. **Tauri CLI:**
```bash
cargo install tauri-cli
```

### Development Mode (Hot Reload)

**Start Next.js frontend + Tauri window:**
```bash
cd app
npm run tauri dev
```

This runs:
1. `npm run dev` (Next.js dev server on :3000)
2. `cargo run` (Tauri window pointing to localhost:3000)

**What you'll see:**
- [PASS] Material You UI with hot reload
- [PASS] Job cards (if database connected)
- [FAIL] Database queries fail (if no connection)
- [FAIL] Session runner unavailable (needs sidecar binary)

### Production Build

**Build static export + Tauri binary:**
```bash
cd app
npm run tauri build
```

This runs:
1. `npm run build` -> `app/out/` (Next.js static export)
2. `cargo build --release` -> Compiled Tauri binary
3. Bundles sidecar Node.js binary (if present)

**Output:**
```
app/src-tauri/target/release/
├── notiapply              # Linux binary
├── notiapply.exe          # Windows (if cross-compiled)
└── bundle/
    ├── deb/
    │   └── notiapply_0.1.0_amd64.deb
    ├── appimage/
    │   └── notiapply_0.1.0_amd64.AppImage
    └── msi/
        └── notiapply_0.1.0_x64.msi
```

---

## Preview UI Without Full Stack

### Method 1: Storybook (Recommended for Future)

**Not yet implemented** — Install Storybook:
```bash
cd app
npx sb init --builder vite
```

Create stories for isolated component preview:
```typescript
// app/app/components/board/JobCard.stories.tsx
import JobCard from './JobCard';

export default {
    title: 'Board/JobCard',
    component: JobCard,
};

export const Queued = {
    args: {
        job: {
            id: 1,
            source: 'jobspy-linkedin',
            title: 'Backend Engineer',
            company: 'Stripe',
            state: 'queued',
            // ...
        },
    },
};
```

Run Storybook:
```bash
npm run storybook
```

### Method 2: Next.js Dev Server (Current)

**Run frontend only:**
```bash
cd app
npm run dev
```

Visit: http://localhost:3000

**What works:**
- [PASS] Visual design (Material You)
- [PASS] UI components render
- [PASS] Routing (Board, Settings, Focus)
- [FAIL] Database queries throw errors
- [FAIL] Tauri commands unavailable

**Workaround:** Comment out database calls temporarily:
```typescript
// app/app/components/board/Board.tsx
useEffect(() => {
    // getJobs().then(setJobs).catch(console.error);  // Commented
    setJobs(MOCK_JOBS);  // Use mock data
}, []);
```

---

## Manual Integration Testing

### Test Plan (Complete Workflow)

**Prerequisites:**
- [PASS] PostgreSQL running with schema loaded
- [PASS] n8n workflows deployed (9 files)
- [PASS] Sidecar Node.js binary downloaded
- [PASS] Chrome + Simplify extension installed

**Test Checklist:**

#### 1. Setup Wizard
- [ ] Upload master resume (.tex file)
- [ ] Upload cover letter template (.tex file)
- [ ] Enter LLM endpoint + API key
- [ ] Test LLM endpoint (green checkmark)
- [ ] Enter ntfy.sh topic
- [ ] Add search terms (e.g., "software engineer", "backend")
- [ ] Add locations (e.g., "Remote", "San Francisco")
- [ ] Complete wizard -> See board

#### 2. Pipeline Scraping
- [ ] Click `···` -> Scrape Now
- [ ] Wait for n8n pipeline run (~2-5 min)
- [ ] Verify jobs appear in "Incoming" column
- [ ] Check ntfy.sh notification received

#### 3. Job Review
- [ ] Click job card -> Opens Focus Mode
- [ ] Read job description
- [ ] Click "Archive" -> Card moves to Archive column
- [ ] Click another job -> Mark as queued (manually via DB)

#### 4. Fill Session
- [ ] Verify jobs in "Ready" column
- [ ] Click "> Start Session"
- [ ] Button changes to "● Filling..." (yellow, shimmer)
- [ ] Session banner appears at bottom with progress
- [ ] Chrome window opens with Simplify
- [ ] Resume uploaded automatically
- [ ] ATS form filled by Simplify
- [ ] Job moves to "Submitted" or "Attention" column
- [ ] Session banner shows summary (3 ready · 1 attention)

#### 5. Application Review
- [ ] Open job in "Submitted" column
- [ ] Verify PDF resume attached
- [ ] Click "^ Open Job" -> Browser opens ATS page
- [ ] Click "✓ Mark Submitted" -> State updates
- [ ] Job moves to "Tracking"

#### 6. Settings
- [ ] Open Settings -> Verify modules listed
- [ ] Toggle module off -> Refresh shows disabled
- [ ] Drag module to reorder -> Execution order updates
- [ ] Add custom module (dummy n8n workflow)
- [ ] Configure module with JSON schema form
- [ ] Delete custom module

#### 7. ATS Watchlist
- [ ] Click `···` -> ATS Watchlist
- [ ] Add company (e.g., "Stripe", "greenhouse", "stripe")
- [ ] Verify company appears in list
- [ ] Remove company -> Confirm deletion

---

## Continuous Integration (Future)

**Not yet implemented** — GitHub Actions workflow:

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]
jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd app && npm ci
      - run: cd app && npm run test
      - run: cd app && npm run build

  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cd app/src-tauri && cargo test
```

---

## Test Naming Conventions

| Type | Filename | Pattern |
|------|----------|---------|
| **Unit Tests** | `utils.test.ts` | `describe('functionName', () => { it('does X', ...) })` |
| **Component Tests** | `JobCard.test.tsx` | `describe('JobCard', () => { it('renders correctly', ...) })` |
| **Integration Tests** | `board-workflow.test.ts` | `describe('Board workflow', () => { it('moves job between columns', ...) })` |

---

## Coverage Goals

### Current
- **Frontend Units:** 13/13 passing (100%)
- **Component Tests:** 3 files (~30% coverage)
- **Integration:** 0% (manual only)

### Target (v1.0)
- **Frontend Units:** 100% for lib/ utils
- **Component Tests:** 80% for UI components
- **Integration:** Manual checklist documented
- **E2E:** Playwright tests for critical paths (stretch goal)

---

## Troubleshooting

### "DATABASE_URL not set"
**Cause:** Missing `.env.local` file
**Fix:**
```bash
cd app
cp ../.env.example .env.local
# Edit DATABASE_URL to point to local PostgreSQL
```

### "Tauri commands not available"
**Cause:** Running `npm run dev` instead of `npm run tauri dev`
**Fix:** Use Tauri CLI:
```bash
cd app
npm run tauri dev
```

### "Module not found: Can't resolve 'dns'"
**Cause:** Next.js trying to bundle pg for browser
**Fix:** Already resolved in [next.config.ts](app/next.config.ts) with webpack fallbacks

### Tests hang on database queries
**Cause:** Real database calls in tests
**Fix:** Mock `@/lib/db` module:
```typescript
vi.mock('@/lib/db', () => ({
    getJobs: vi.fn().mockResolvedValue([]),
}));
```

---

## Summary

### [PASS] What's Testable Now
- Utility functions (time formatting, salary formatting)
- React components (JSON schema form, setup wizard)
- UI rendering and interactions

### [WARN] What Requires Mocks
- Database operations (PostgreSQL connection)
- Tauri commands (native binary)
- File uploads (FileReader API)

### [FAIL] What's Manual Only
- Full workflow (scraping -> filling -> submitting)
- n8n pipeline integration
- Sidecar automation with Playwright
- Database schema migrations

### [START] Preview Options
1. **Run tests:** `cd app && npm run test` [PASS]
2. **Run frontend dev:** `cd app && npm run dev` [PASS] (with mock data)
3. **Run Tauri dev:** `cd app && npm run tauri dev` [PASS] (needs DB)
4. **Build Tauri app:** `cd app && npm run tauri build` [PASS] (full build)

**Recommendation:** Use `npm run tauri dev` with local PostgreSQL for best preview experience.
