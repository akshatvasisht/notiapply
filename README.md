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
![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js&logoColor=white)
![n8n](https://img.shields.io/badge/n8n-Orchestration-FF6D5A?logo=n8n&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

Notiapply is a self-hosted job search management platform. It consolidates discovery, document generation, and submission tracking into a single local-first desktop application — keeping all data under your control with no third-party services.

## How it Works

1. **Discovery**: Python scrapers poll ATS APIs (Greenhouse, Lever, Ashby) and job aggregators on a schedule, deduplicating results into a local PostgreSQL database.
2. **Preparation**: An LLM tailors your master resume to each job description, compiling a job-specific PDF via LaTeX.
3. **Submission**: A Playwright-based sidecar fills ATS forms deterministically, halting for manual review when it encounters unknown fields or CAPTCHAs.
4. **Tracking**: A Kanban board surfaces your full pipeline — from incoming listings to submitted applications — with search, filtering, and bulk actions.

<details>
  <summary><b>View Screenshots</b></summary>
  <br>

| Dashboard | Sidecar |
| :---: | :---: |
| <img src="docs/images/dashboard.png" width="100%"> | <img src="docs/images/sidecar.png" width="100%"> |

</details>

## Technical Highlights

- **Data Sovereignty**: Everything — resumes, keys, pipeline state — lives locally. Nothing is sent to third-party services.
- **Deterministic Automation**: A Playwright sidecar handles form submission via shadow-DOM traversal, avoiding the fragility of AI-driven agents.
- **Fault-Tolerant Execution**: Per-job sidecar isolation means a bad ATS schema never stalls the rest of the queue.
- **Dynamic Resume Generation**: Real-time LaTeX template injection produces a tailored PDF for every application.
- **Proxy-Free Discovery**: Tier-1 scraping operates at single-user request rates; Tier-4 (Wellfound) uses fingerprint-spoofing instead of paid residential proxies.

## Documentation

- **[SETUP.md](docs/SETUP.md)**: Environment, deployment options, and build instructions.
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)**: IPC contracts, DB schema, and system data flow.
- **[TESTING.md](docs/TESTING.md)**: Unit tests, E2E suite, and integration test checklist.
- **[STYLE.md](docs/STYLE.md)**: Architectural invariants and monorepo conventions.

## License

See **[LICENSE](LICENSE)** file for details.
