#!/usr/bin/env bash
set -Eeuo pipefail

# One-command recovery for a bootstrap-created stub auth.users table.
# Run from anywhere inside the cloned repository:
#   sudo bash deploy/oracle-supabase/repair-auth.sh

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
RESET_SQL="/tmp/forwardflow-04-reset-auth.sql"
RELINK_SQL="/tmp/forwardflow-05-relink-auth.sql"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash deploy/oracle-supabase/repair-auth.sh"
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  echo "ERROR: $SCRIPT_DIR/.env not found"
  exit 1
fi

install -m 0644 "$SCRIPT_DIR/04_reset_auth.sql" "$RESET_SQL"
install -m 0644 "$SCRIPT_DIR/05_relink_auth.sql" "$RELINK_SQL"

echo "[1/6] Stopping auth so it cannot access the schema during repair..."
docker compose --env-file "$SCRIPT_DIR/.env" -f "$COMPOSE_FILE" stop auth

echo "[2/6] Removing the incompatible stub auth schema..."
sudo -u postgres psql -v ON_ERROR_STOP=1 -d forwardflow -f "$RESET_SQL"

echo "[3/6] Starting auth and allowing it to create its real schema..."
docker compose --env-file "$SCRIPT_DIR/.env" -f "$COMPOSE_FILE" up -d --force-recreate auth

echo "[4/6] Waiting for the real auth.users table (up to 90 seconds)..."
ready="false"
for _ in $(seq 1 45); do
  if sudo -u postgres psql -d forwardflow -tAc \
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='auth' AND table_name='users' AND column_name='encrypted_password')" \
    | grep -qx 't'; then
    ready="true"
    break
  fi
  sleep 2
done

if [[ "$ready" != "true" ]]; then
  echo "ERROR: auth.users was not created. Latest auth logs:"
  docker compose --env-file "$SCRIPT_DIR/.env" -f "$COMPOSE_FILE" logs --tail=100 auth
  exit 1
fi

echo "[5/6] Restoring app links and the signup trigger..."
sudo -u postgres psql -v ON_ERROR_STOP=1 -d forwardflow -f "$RELINK_SQL"

echo "[6/6] Verifying auth schema and API..."
sudo -u postgres psql -d forwardflow -tAc \
  "SELECT 'auth.users ready: ' || EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='auth' AND table_name='users' AND column_name='encrypted_password')"
docker compose --env-file "$SCRIPT_DIR/.env" -f "$COMPOSE_FILE" ps auth
curl --fail --silent --show-error http://127.0.0.1:8000/auth/v1/health
echo
echo "AUTH REPAIR COMPLETE"