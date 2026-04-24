# notiapply — backend stack (Docker Compose)

Docker Compose stack for the notiapply backend: **n8n** (orchestrator) +
**Postgres** (state) + **Python runner** (hosts the scrapers behind a thin
HTTP API). Works on a laptop for all-in-one local dev, or on a VPS for the
split-brain remote backend reached by the Tauri app over Tailscale.

Services:

| Service  | Purpose                                      | Host port         |
|----------|----------------------------------------------|-------------------|
| postgres | Shared state (jobs, contacts, runs, configs) | none (private)    |
| n8n      | Workflow orchestrator + editor UI            | 127.0.0.1:5678    |
| runner   | Python HTTP wrapper around `server/scraper/` | 127.0.0.1:8080    |

## First-time setup

```bash
cd deploy/docker
cp .env.example .env

# Generate three 32-byte secrets
openssl rand -hex 32   # -> POSTGRES_PASSWORD
openssl rand -hex 32   # -> N8N_ENCRYPTION_KEY
openssl rand -hex 32   # -> NOTIAPPLY_WEBHOOK_SECRET
```

Edit `.env` and paste in the three values above. Then pick
`N8N_EDITOR_BASE_URL`:

- **Laptop / local dev:** `http://localhost:5678`
- **VPS via Tailscale Serve:** `https://<host>.<tailnet>.ts.net`

This value MUST match the URL you actually open n8n on. n8n bakes it into
webhook URLs; a mismatch means webhooks "register" but never fire.

Bring the stack up and apply schema:

```bash
docker compose up -d          # postgres + n8n + runner
docker compose ps             # all three services should report healthy
./migrate.sh                  # applies migrations/*.sql idempotently
```

Open the editor URL, finish n8n's owner-account setup. The stack is ready.

## Running locally (laptop, all-in-one)

Nothing extra. With `N8N_EDITOR_BASE_URL=http://localhost:5678`:

1. `docker compose up -d && ./migrate.sh`
2. Open <http://localhost:5678>, create the n8n owner account.
3. Point the Tauri app's n8n base URL at `http://localhost:5678`.

The runner is reachable from n8n at `http://runner:8080` (compose DNS) and
from the host at `http://127.0.0.1:8080` for ad-hoc curl testing:

```bash
curl http://127.0.0.1:8080/healthz
```

## Running on a VPS

Same compose file; only the exposure story changes.

1. Install Tailscale on the VPS and join your tailnet.
2. Firewall: only SSH (22) and whatever Tailscale needs should be open to
   the public internet. **Do not** expose 5678 or 8080 publicly — the
   compose file binds both to `127.0.0.1` on purpose.
3. Front n8n with Tailscale Serve so the Tauri app can reach it over the
   tailnet with auto-HTTPS:

   ```bash
   sudo tailscale serve --bg --https=443 http://127.0.0.1:5678
   tailscale serve status
   ```

4. Set `N8N_EDITOR_BASE_URL` in `.env` to the tailnet URL, e.g.
   `https://<host>.<tailnet>.ts.net`. Grab it with:

   ```bash
   tailscale status --json | jq -r '.Self.DNSName'
   ```

5. Restart n8n so the new base URL takes effect: `docker compose up -d n8n`.
6. Point the Tauri app at the same tailnet URL.

## Operational notes

- All three services use `restart: unless-stopped` — they come back after
  reboot.
- Postgres has no host port binding; reach it via `docker exec -it
  notiapply-postgres psql -U notiapply -d notiapply` from the host.
- n8n and runner bind `127.0.0.1` only. Never switch to `0.0.0.0` without
  also adding a firewall rule.
- **Applying new migrations:** pull the repo, then re-run `./migrate.sh`.
  The tracking table (`schema_migrations`) causes already-applied files to
  report `skip:` and only new files are executed.
- `docker compose down` preserves data (named volumes). `docker compose
  down -v` wipes everything including workflows and jobs.

### Backup

Named volumes are `docker_postgres_data` and `docker_n8n_data` (the prefix
matches the directory name, so confirm with `docker volume ls | grep
notiapply`). Snapshot Postgres with:

```bash
docker run --rm \
  -v docker_postgres_data:/src \
  -v "$PWD":/dst \
  alpine tar czf /dst/postgres-$(date +%F).tgz -C /src .
```

For a logical dump instead:

```bash
docker exec notiapply-postgres pg_dump -U notiapply notiapply \
  | gzip > notiapply-$(date +%F).sql.gz
```

## n8n API key for MCP workflow authoring

Once the owner account exists, go to **Settings → API** in the n8n UI and
generate a personal API key. Paste it into whichever MCP server you use to
author workflows from Claude (e.g. n8n-MCP). See the n8n API docs:
<https://docs.n8n.io/api/>.
