#!/bin/bash
set -e
echo "=== Notiapply Bootstrap ==="

# 0. Detect architecture
ARCH=$(uname -m)
case $ARCH in
  x86_64)
    TECTONIC_ARCH="x86_64-unknown-linux-musl"
    DBMATE_ARCH="linux-amd64"
    ;;
  aarch64)
    TECTONIC_ARCH="aarch64-unknown-linux-musl"
    DBMATE_ARCH="linux-arm64"
    ;;
  *)
    echo "ERROR: Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

echo "Detected architecture: $ARCH"

# 1. System dependencies
sudo apt-get update -qq
sudo apt-get install -y postgresql python3-pip curl

# 2. tectonic
if ! command -v tectonic &>/dev/null; then
  curl -fsSL "https://github.com/tectonic-typesetting/tectonic/releases/latest/download/tectonic-${TECTONIC_ARCH}.tar.gz" \
    | tar xz -C /tmp
  sudo mv /tmp/tectonic /usr/local/bin/
fi

# 3. Python dependencies (pinned versions)
pip3 install --break-system-packages --quiet -r /opt/notiapply/server/requirements.txt

# 4. Playwright Chromium (for Wellfound CF-Clearance-Scraper)
python3 -m playwright install chromium --with-deps

# 5. CF-Clearance-Scraper
if [ ! -d /opt/cf-clearance-scraper ]; then
  git clone --quiet https://github.com/Xewdy444/CF-Clearance-Scraper \
    /opt/cf-clearance-scraper
  pip3 install --break-system-packages --quiet \
    -r /opt/cf-clearance-scraper/requirements.txt
fi

# 6. n8n
if ! command -v n8n &>/dev/null; then
  npm install -g n8n
fi

# 7. dbmate
if ! command -v dbmate &>/dev/null; then
  curl -fsSL "https://github.com/amacneil/dbmate/releases/latest/download/dbmate-${DBMATE_ARCH}" \
    -o /usr/local/bin/dbmate
  chmod +x /usr/local/bin/dbmate
fi

# 8. Postgres
DB_USER="notiapply"
DB_NAME="notiapply"
DB_PASS=$(openssl rand -hex 16)

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  sudo -u postgres psql -U $DB_USER -d $DB_NAME -f /opt/notiapply/schema.sql
  cat > /opt/notiapply/.db_credentials << EOF
DB_USER=$DB_USER
DB_NAME=$DB_NAME
DB_PASS=$DB_PASS
EOF
  chmod 600 /opt/notiapply/.db_credentials
else
  DB_PASS=$(grep DB_PASS /opt/notiapply/.db_credentials | cut -d= -f2)
fi

DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

# 9. Apply migrations (idempotent)
DATABASE_URL="$DATABASE_URL" dbmate up

# 10. Tectonic warm-up (populates ~/.cache/Tectonic)
tectonic /opt/notiapply/examples/resume_example.tex 2>/dev/null || true
tectonic /opt/notiapply/examples/cover_letter_example.tex 2>/dev/null || true

# 11. n8n workflow import
n8n import:workflow --input=/opt/notiapply/server/n8n-workflows/ --separate

# 12. n8n environment (with basic auth)
N8N_AUTH_USER="admin"
N8N_AUTH_PASS=$(openssl rand -hex 16)

cat > /opt/notiapply/.n8n.env << EOF
DATABASE_URL=$DATABASE_URL
NODE_FUNCTION_ALLOW_BUILTIN=fs,path,os
NODES_EXCLUDE=[]
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=$N8N_AUTH_USER
N8N_BASIC_AUTH_PASSWORD=$N8N_AUTH_PASS
EXECUTIONS_PROCESS=main
EOF

# Store n8n credentials
cat >> /opt/notiapply/.db_credentials << EOF
N8N_AUTH_USER=$N8N_AUTH_USER
N8N_AUTH_PASS=$N8N_AUTH_PASS
EOF

# 13. n8n systemd service
sudo tee /etc/systemd/system/n8n.service > /dev/null << EOF
[Unit]
Description=n8n workflow automation
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/notiapply
EnvironmentFile=/opt/notiapply/.n8n.env
ExecStart=/usr/bin/n8n start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable n8n
sudo systemctl start n8n

# 14. Register n8n webhook and write URL into user_config
echo "Waiting for n8n to be ready..."
n8n_ready=false
for i in $(seq 1 30); do
  if curl -sf http://localhost:5678/healthz > /dev/null 2>&1; then
    n8n_ready=true
    break
  fi
  sleep 2
done

if [ "$n8n_ready" = false ]; then
  echo "ERROR: n8n failed to start within 60 seconds" >&2
  echo "Check logs: sudo journalctl -u n8n --no-pager -n 50" >&2
  exit 1
fi

echo "n8n is ready"
n8n update:workflow --id=00-orchestrator --active=true 2>/dev/null || true

WEBHOOK_SECRET=$(openssl rand -hex 24)
ORACLE_IP=$(curl -sf http://checkip.amazonaws.com || echo "ORACLE_IP")
WEBHOOK_URL="http://${ORACLE_IP}:5678/webhook/notiapply-run"

sudo -u postgres psql -U $DB_USER -d $DB_NAME -c \
  "UPDATE user_config SET config = config ||
   jsonb_build_object('n8n_webhook_url', '${WEBHOOK_URL}',
                      'n8n_webhook_secret', '${WEBHOOK_SECRET}')
   WHERE id = 1;"

# Done
echo ""
echo "=== Bootstrap complete ==="
echo ""
echo "Credentials have been stored in /opt/notiapply/.db_credentials (chmod 600)"
echo ""
echo "Copy this line into your local .env file:"
echo ""
echo "  DATABASE_URL=postgresql://$DB_USER:[REDACTED]@localhost:5432/$DB_NAME"
echo ""
echo "That is the only manual step. Launch Notiapply and the wizard"
echo "will guide you through the rest. The n8n webhook URL has been"
echo "written to your database automatically."
echo ""
echo "n8n dashboard: http://localhost:5678"
echo "n8n credentials: see /opt/notiapply/.db_credentials"
