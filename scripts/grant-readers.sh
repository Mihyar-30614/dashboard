#!/usr/bin/env bash
set -euo pipefail
# Usage: APP_DB_PASSWORDS_JSON='{"sportly":"...","honeydoeh":"...","debtmanager":"..."}' \
#        ./scripts/grant-readers.sh
# Run against each app DB. Requires superuser psql access.

read_pw() { python3 -c "import os,json;print(json.loads(os.environ['APP_DB_PASSWORDS_JSON'])['$1'])"; }

run() {
  local db="$1" pw="$2"
  psql "$db" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dashboard_reader') THEN
    EXECUTE format('CREATE ROLE dashboard_reader LOGIN PASSWORD %L', '${pw}');
  ELSE
    EXECUTE format('ALTER ROLE dashboard_reader WITH PASSWORD %L', '${pw}');
  END IF;
END
\$\$;
GRANT CONNECT ON DATABASE $db TO dashboard_reader;
GRANT USAGE ON SCHEMA public TO dashboard_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dashboard_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO dashboard_reader;
SQL
}

run sportly      "$(read_pw sportly)"
run honeydoeh    "$(read_pw honeydoeh)"
run debtmanager  "$(read_pw debtmanager)"
echo "done"
