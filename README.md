<p align="center">
  <img 
    width="200" 
    height="200" 
    alt="Notiapply Logo" 
    src="docs/images/logo.svg" 
  />
</p>

![Rust](https://img.shields.io/badge/Rust-1.80%2B-black?logo=rust&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?logo=tauri&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15.0-black?logo=next.js&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-Automation-2EAD33?logo=playwright&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

Notiapply is an autonomous, self-hosted job application pipeline. It replaces manual job board parsing and repetitive ATS data entry with deterministic browser automation. By offloading discovery to server-side Python scrapers and keeping execution local via a Tauri-wrapped Playwright sidecar, Notiapply provides an end-to-end autonomous application workflow under 100% user data ownership.

### How it Works

Notiapply follows a 4-layer extraction → orchestration → execution architecture:

1. **Discovery Layer (Python Scrapers)**: Runs tiered polling against ATS APIs (Greenhouse, Lever, Ashby), job aggregators, and JS-rendered state blobs.
2. **Orchestration Layer (n8n & PostgreSQL)**: Normalizes inbound listings and applies user-defined filtering logic via structured relational pipelines.
3. **Application Layer (Tauri + Next.js)**: A desktop shell providing a Kanban interface for queue management, configuration schemas, and triggers.
4. **Execution Layer (Playwright Sidecar)**: A Node.js sidecar spawning a deterministic Chromium instance. It leverages the Simplify extension for shadow DOM injection and generates tailored LaTeX resumes on-the-fly.

<details>
  <summary><b>View Screenshots</b></summary>
  <br>

| Dashboard | Sidecar |
| :---: | :---: |
| <img src="docs/images/dashboard.png" width="100%"> | <img src="docs/images/sidecar.png" width="100%"> |

</details>

## Technical Highlights

- **Data Sovereignty**: 100% local ownership of resumes, metrics, and API keys; zero third-party ingestion.
- **Deterministic Automation**: Leverages a Playwright sidecar and shadow DOM injection for verifiable browser actions rather than fragile LLM agents.
- **Fault-Tolerant Execution**: Per-job sidecar isolation ensures local ATS schema changes don't stall the global discovery pipeline.
- **Dynamic PDF Generation**: Real-time LaTeX template injection produces job-specific resumes tailored to every application ID.
- **High-Signal Discovery**: Scraper-level deduplication and multi-tier API polling minimize database bloat and invalid entries.
- **Resource Efficient**: A Tauri + Next.js (SSG) architecture provides a desktop UI with a fraction of the footprint of Electron.

## Documentation

- **[SETUP.md](docs/SETUP.md)**: Environment, Oracle Cloud infra, and Tauri build.
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)**: IPC contracts, DB schemas, and system flow.
- **[TESTING.md](docs/TESTING.md)**: Playwright sidecar debugging and suite execution.
- **[STYLE.md](docs/STYLE.md)**: Architectural invariants and monorepo conventions.

## License

See **[LICENSE](LICENSE)** file for details.
