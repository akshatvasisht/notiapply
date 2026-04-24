# Setting Up Notiapply

Notiapply ships two deployment shapes, both built on the same Docker Compose stack at `deploy/docker/` (postgres + n8n + FastAPI runner):

- **All-in-one local**: the compose stack and the Tauri desktop app run on the same machine. Easiest for development.
- **Split-brain**: the compose stack runs on a 24/7 VPS (e.g. an Oracle Free Tier ARM instance, a Hetzner CX22, or similar); the Tauri desktop app runs on your laptop and points at the remote n8n/DB over Tailscale.

The backend stack is identical in both shapes. Only the networking between the Tauri app and the backend changes.

## Prerequisites

- **Docker**: 24+ with the `compose` plugin (required for the backend stack).
- **Node.js**: v20 or higher (required for the Tauri frontend and the Playwright sidecar).
- **Python**: v3.10 or higher (only needed if you want to run scraper code outside of Docker for development).
- **Rust toolchain**: `cargo` and `rustc` (only needed to build the Tauri desktop binary).
- **System dependencies** for Tauri on Linux: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`.

## Quick Start: All-in-One Local

1. **Backend stack.** Follow `deploy/docker/README.md` to bring up postgres, n8n, and the runner locally. That guide is the authoritative source for compose commands, migrations, and initial config. The runner image ships with a pinned Tectonic binary built at image build time — a plain `docker compose up -d` builds it on first run. To bump Tectonic later: `docker compose build --build-arg TECTONIC_VERSION=0.17.0 runner` (see `deploy/docker/runner.Dockerfile` for the default pin and the link to upstream releases).

2. **Frontend (Tauri + Next.js).**
   ```bash
   cd app
   npm install
   npm run dev        # Next.js dev server on localhost:3000
   # or
   npx tauri dev      # Tauri desktop window with hot reload
   ```

3. **Sidecar (Playwright form-filler).**
   ```bash
   cd sidecar
   npm install
   ```
   The sidecar is invoked on demand by the Tauri app — no persistent process to start.

4. Open the desktop app, complete the setup wizard, and point the n8n webhook URL at `http://localhost:5678/webhook/notiapply-run` (or whatever the compose stack exposes).

## Quick Start: Split-Brain on a VPS

1. **Deploy the backend.** Copy `deploy/docker/` to your VPS and follow the same `README.md` there. Any x86_64 or ARM64 host with Docker works; Oracle Free Tier is a common choice because the ARM shape is persistently free.

2. **Expose n8n over Tailscale.** Install Tailscale on the VPS and use `tailscale serve` to publish n8n on your tailnet. The exact command and TLS setup live in `deploy/docker/README.md`. The result is a stable `https://<host>.<tailnet>.ts.net` URL reachable from any device on your tailnet.

3. **Install the frontend locally.**
   ```bash
   cd app
   npm install
   cd ../sidecar
   npm install
   ```

4. **Point Tauri at the remote n8n.** In the desktop app's Settings (or seeded via `user_config`), set `n8n_webhook_url` to the tailnet URL from step 2. Set `DATABASE_URL` in your local `.env` to the remote postgres (also reachable via Tailscale).

## Enabling Gmail reply detection (optional)

The `gmail-watch` pipeline module polls Gmail for replies from contacts in `state='contacted'`. Authentication is bootstrapped once on the host, then the runner container reads a refresh-token file from a mounted volume — it never opens a browser itself.

1. Create OAuth client credentials (Desktop app type) in Google Cloud Console, enable the Gmail API, download the JSON.
2. Save the file at `deploy/docker/gmail/gmail_credentials.json` (dir is gitignored).
3. From the repo root:
   ```bash
   python server/gmail_auth_init.py
   ```
   Opens a browser, runs the OAuth flow, writes `gmail_token.json` next to the credentials file with chmod 600.
4. `docker compose restart runner` so the container picks up the mounted token.
5. Verify:
   ```bash
   curl -X POST http://127.0.0.1:8080/run/gmail-watch \
     -H "X-Webhook-Secret: $NOTIAPPLY_WEBHOOK_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"module_config": {"lookback_days": 14}}'
   ```

The `google-auth` library rewrites the token on refresh (~1h cadence), which is why the volume mount is read-write. Tokens stay on the host — never commit `deploy/docker/gmail/`.

## Encrypting user_config secrets at rest (optional but recommended)

If `ENCRYPTION_KEY` is set in `.env` (32-byte hex, generate via `openssl rand -hex 32`), the frontend's `updateSecureConfig` helper AES-256-GCM-encrypts 8 sensitive fields (LLM API key, ATS passwords, GitHub token, etc.) before writing to `user_config.config`. The backend's `decrypt_config` helper unwraps them on read. If you change existing plaintext rows to encrypted, run the one-shot migration:

```bash
ENCRYPTION_KEY=$(grep ENCRYPTION_KEY .env | cut -d= -f2) npx tsx app/scripts/migrate-encrypt-secrets.ts
```

The helper is idempotent — already-encrypted rows are detected via envelope format (`iv:tag:ciphertext`) and skipped.

## Production Tauri Build

```bash
cd app
npx tauri build
```

The compiled binary lands in `app/src-tauri/target/release/`.

## Configuration Workflow

1. Launch the Tauri app.
2. Complete the 4-step Setup Wizard:
   - LLM endpoint + API key. Required: OpenAI-compatible `/v1/chat/completions` shape. Works with OpenAI, Google AI Studio (`https://generativelanguage.googleapis.com/v1beta/openai`), OpenRouter, Ollama, LM Studio, etc. For native Anthropic Claude, use OpenRouter or a LiteLLM proxy.
   - Master `.tex` resume. Generic templates are in [examples/](examples/).
   - Target tags and ATS watchlist.
3. Confirm n8n webhook URLs in Settings (local `localhost:5678` or the tailnet URL).
4. Jobs populate in the Kanban board as the n8n cron fires.
