# Setting Up Notiapply

Notiapply consists of three localized domains: the scraping fleet (usually headless), the automation sidecar, and the desktop UI.

---

## System Prerequisites

- **Node.js**: v20 or higher.
- **Python**: v3.10 or higher.
- **Rust Toolchain**: `cargo` and `rustc` for building the Tauri app.
- **System Dependencies**: `libwebkit2gtk-4.1-dev` (Linux), `build-essential`, `curl`.

## Deployment Options

Notiapply can execute entirely on your local machine, or run a "split brain" architecture where the scraping database lives on a remote server (e.g. an Oracle Free Tier ARM instance) and the Tauri desktop app connects to it remotely.

### Option 1: The Idempotent Bootstrap (Recommended for Remote DB/Scraper)

The included `bootstrap.sh` script installs the entire backend pipeline. It is idempotent—safe to run multiple times.

```bash
chmod +x bootstrap.sh
./bootstrap.sh
```

**What it does:**
1. Installs the Tectonic LaTeX pipeline.
2. Maps a Python `venv` and installs scraper dependencies.
3. Installs global OS tools (dbmate, Chromium).
4. Provisions a local PostgreSQL instance.
5. Runs the `dbmate up` database migrations.
6. Sets up the n8n global process and registers it as a systemd service.

### Option 2: Local Desktop Setup

If you wish to run the entire pipeline directly on your personal machine without the bootstrap script:

#### 1. Database Initialization
```bash
# Provide a valid POSTGRES_URL string
export DATABASE_URL="postgres://user:pass@localhost:5432/notiapply"

# Run migrations
dbmate -d migrations up
```

#### 2. Sidecar Initialization
The Playwright sidecar requires local node modules to function.
```bash
cd sidecar
npm install
```

#### 3. Tauri Desktop Application
The desktop shell runs on Next.js 16 and Tauri v2.

```bash
cd app
npm install

# Start the development server and the Tauri window
npx tauri dev
```

For a production release:
```bash
npx tauri build
```

The compiled binary will be located in `app/src-tauri/target/release/`.

---

## Configuration Workflow

1. Open the Tauri application.
2. Complete the initial 4-step **Setup Wizard**.
   - Input your Google AI Studio (`gemini-1.5-flash`) API Key.
   - Attach your baseline `.tex` master resume.
   - Define your target behavioral tags and ATS platform watchlist.
3. Once in the Kanban board, access the **Settings** panel to explicitly map the SQLite `n8n` database hook URLs if operating in the remote-split architecture.
4. Jobs will populate in the `incoming` and `ready` columns as the Python fleet executes.
