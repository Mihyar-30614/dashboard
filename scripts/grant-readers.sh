#!/usr/bin/env bash
set -euo pipefail
# Provisions the shared read-only role used by the dashboard for app DBs
# (collectors via config/apps.json and SQL widgets via config/data_sources.json).
# Usage: RO_PASSWORD='...' ./scripts/grant-readers.sh
# Then set the same password in .env: APP_DB_PASSWORDS_JSON and
# DATA_SOURCE_RO_PASSWORDS_JSON (JSON maps keyed by app/data-source name).
# Requires superuser psql access.

: "${RO_PASSWORD:?set RO_PASSWORD}"

run() {
  local db="$1"
  psql "$db" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dashboard_reader') THEN
    EXECUTE format('CREATE ROLE dashboard_reader LOGIN PASSWORD %L', '${RO_PASSWORD}');
  ELSE
    EXECUTE format('ALTER ROLE dashboard_reader WITH PASSWORD %L', '${RO_PASSWORD}');
  END IF;
END
\$\$;
GRANT CONNECT ON DATABASE $db TO dashboard_reader;
GRANT USAGE ON SCHEMA public TO dashboard_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dashboard_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO dashboard_reader;
SQL
}

run sportly
run honeydoeh
run debtapp
echo "done"
