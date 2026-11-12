#!/usr/bin/env bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "${DASHBOARD_NODE_BIN:-node}" "$APP_DIR/operations/backup-database.cjs" "${BACKUP_DIR:-$APP_DIR/backups/database}"
