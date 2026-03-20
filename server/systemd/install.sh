#!/bin/bash
set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo ./install.sh"
  exit 1
fi

# Get the actual user (not root)
ACTUAL_USER=${SUDO_USER:-$(logname)}
WORKDIR="/home/$ACTUAL_USER/notiapply/server"
VENV_DIR="$WORKDIR/venv"

# Prompt for DATABASE_URL
read -p "Enter DATABASE_URL: " DB_URL

# Create log directory
mkdir -p /var/log/notiapply
chown $ACTUAL_USER:$ACTUAL_USER /var/log/notiapply

# Copy service files and substitute variables
cat gmail-watcher.service | \
  sed "s|%REPLACE_USER%|$ACTUAL_USER|g" | \
  sed "s|%REPLACE_WORKDIR%|$WORKDIR|g" | \
  sed "s|%REPLACE_DB_URL%|$DB_URL|g" | \
  sed "s|%REPLACE_VENV%|$VENV_DIR|g" > /etc/systemd/system/gmail-watcher.service

cp gmail-watcher.timer /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Enable and start timer
systemctl enable gmail-watcher.timer
systemctl start gmail-watcher.timer

echo ""
echo "✓ Gmail watcher installed for user: $ACTUAL_USER"
echo ""
echo "Commands:"
echo "  Check status: systemctl status gmail-watcher.timer"
echo "  View logs:    journalctl -u gmail-watcher -f"
echo "  Run now:      systemctl start gmail-watcher.service"
