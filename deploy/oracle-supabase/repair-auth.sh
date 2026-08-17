#!/usr/bin/env bash
set -Eeuo pipefail

# One-command recovery for a bootstrap-created stub auth.users table.
# Run from anywhere inside the cloned repository:
#   sudo bash deploy/oracle-supabase/repair-auth.sh

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
RESET_SQL="/tmp/forwardflow-04-reset-auth.sql"
RELINK_SQL="/tmp/forwardflow-05-relink-auth.sql"
DB_NAME="forwardflow"
repair_complete="false"

recover_auth_on_error() {
  if [[ "$repair_complete" != "true" ]]; then
    echo "Repair stopped early; ensuring auth is not left offline..."
    docker compose --env-file "$SCRIPT_DIR/.env" -f "$COMPOSE_FILE" up -d auth >/dev/null 2>&1 || true
  fi
}

trap recover_auth_on_error EXIT

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
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$RESET_SQL"

# GoTrue must be able to connect, create its migration tables, and use the
# helper functions after the old bootstrap-created auth schema is removed.
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<'SQL'
ALTER ROLE supabase_auth_admin LOGIN;
GRANT CONNECT ON DATABASE forwardflow TO supabase_auth_admin;
GRANT USAGE, CREATE ON SCHEMA auth TO supabase_auth_admin;
ALTER ROLE supabase_auth_admin SET search_path = auth, public;
SQL

echo "[3/6] Starting auth and allowing it to create its real schema..."
docker compose --env-file "$SCRIPT_DIR/.env" -f "$COMPOSE_FILE" up -d --force-recreate auth

echo "[4/6] Waiting for the real auth.users table (up to 90 seconds)..."
ready="false"
for _ in $(seq 1 45); do
  if sudo -u postgres psql -d "$DB_NAME" -tAc \
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
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$RELINK_SQL"

echo "[6/6] Verifying auth schema and API..."
column_count="$(sudo -u postgres psql -d "$DB_NAME" -tAc \
  "SELECT count(*) FROM information_schema.columns WHERE table_schema='auth' AND table_name='users')")"
if [[ "$column_count" -lt 20 ]]; then
  echo "ERROR: auth.users is incomplete (only $column_count columns; expected at least 20)."
  docker compose --env-file "$SCRIPT_DIR/.env" -f "$COMPOSE_FILE" logs --tail=120 auth
  exit 1
fi

# Verify that the exact operation which previously returned HTTP 500 now
# succeeds. The temporary account is removed immediately afterwards.
health="$(curl --fail --silent --show-error http://127.0.0.1:8000/auth/v1/health)"
test_email="forwardflow-auth-check-$(date +%s)@example.com"
signup_body="$(printf '{"email":"%s","password":"RepairCheck!9284"}' "$test_email")"
signup_response="$(curl --silent --show-error --write-out $'\n%{http_code}' \
  -H 'Content-Type: application/json' \
  --data "$signup_body" \
  http://127.0.0.1:8000/auth/v1/signup)"
signup_status="${signup_response##*$'\n'}"
signup_json="${signup_response%$'\n'*}"
if [[ "$signup_status" -ge 500 || "$signup_status" -lt 200 || "$signup_status" -ge 300 ]]; then
  echo "ERROR: signup self-test returned HTTP $signup_status: $signup_json"
  echo "Latest auth logs:"
  docker compose --env-file "$SCRIPT_DIR/.env" -f "$COMPOSE_FILE" logs --tail=120 auth
  exit 1
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" \
  -c "DELETE FROM auth.users WHERE email = '$test_email'" >/dev/null
echo "auth.users ready: $column_count columns"
docker compose --env-file "$SCRIPT_DIR/.env" -f "$COMPOSE_FILE" ps auth
echo "$health"
echo "signup self-test: HTTP $signup_status"
echo "AUTH REPAIR COMPLETE"
repair_complete="true"