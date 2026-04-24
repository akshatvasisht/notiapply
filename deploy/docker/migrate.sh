#!/usr/bin/env bash
# migrate.sh — idempotent notiapply schema migrator.
#
# Applies every migrations/*.sql (repo-root) against the Postgres container in
# filename order, tracking applied files in a schema_migrations table so
# re-runs are no-ops.
#
# Usage:
#   ./migrate.sh                           # uses default container notiapply-postgres
#   ./migrate.sh my-postgres-container     # override container name
#   POSTGRES_CONTAINER=foo ./migrate.sh    # or via env
#
# Reads POSTGRES_USER and POSTGRES_DB from .env in this directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
MIGRATIONS_DIR="${SCRIPT_DIR}/../../migrations"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "error: ${ENV_FILE} not found. Copy .env.example to .env first." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
. "${ENV_FILE}"
set +a

: "${POSTGRES_USER:?POSTGRES_USER must be set in .env}"
: "${POSTGRES_DB:?POSTGRES_DB must be set in .env}"

CONTAINER="${1:-${POSTGRES_CONTAINER:-notiapply-postgres}}"

if [[ ! -d "${MIGRATIONS_DIR}" ]]; then
  echo "error: migrations dir not found at ${MIGRATIONS_DIR}" >&2
  exit 1
fi

# Quick sanity: container running?
if ! docker inspect -f '{{.State.Running}}' "${CONTAINER}" >/dev/null 2>&1; then
  echo "error: container '${CONTAINER}' is not running. Try: docker compose up -d" >&2
  exit 1
fi

psql_exec() {
  # Runs psql inside the container with ON_ERROR_STOP; stdin is forwarded.
  docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD:-}" "${CONTAINER}" \
    psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" "$@"
}

# 1. Ensure tracking table exists.
psql_exec -q -c "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());" >/dev/null

# 2. Iterate migrations in filename order (the numeric prefixes sort lexicographically).
shopt -s nullglob
files=( "${MIGRATIONS_DIR}"/*.sql )
shopt -u nullglob

if (( ${#files[@]} == 0 )); then
  echo "no migrations found in ${MIGRATIONS_DIR}"
  exit 0
fi

# Sort just to be explicit (glob is already sorted on most shells, but be safe).
IFS=$'\n' files=($(printf '%s\n' "${files[@]}" | sort))
unset IFS

applied_count=0
skipped_count=0

for f in "${files[@]}"; do
  version="$(basename "${f}" .sql)"

  # Is it already applied?
  existing="$(psql_exec -tAq -c "SELECT 1 FROM schema_migrations WHERE version = '${version}';" | tr -d '[:space:]')"
  if [[ "${existing}" == "1" ]]; then
    echo "skip:    ${version}"
    skipped_count=$((skipped_count + 1))
    continue
  fi

  # Apply. Pipe the file directly to psql with ON_ERROR_STOP so a bad
  # statement aborts the script before we record it as applied.
  if ! psql_exec -q < "${f}" >/dev/null; then
    echo "FAILED:  ${version}" >&2
    exit 1
  fi

  psql_exec -q -c "INSERT INTO schema_migrations (version) VALUES ('${version}');" >/dev/null
  echo "applied: ${version}"
  applied_count=$((applied_count + 1))
done

echo
echo "done. applied=${applied_count} skipped=${skipped_count} total=${#files[@]}"
