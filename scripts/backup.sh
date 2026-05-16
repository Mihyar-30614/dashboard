#!/usr/bin/env bash
set -euo pipefail
OUT_DIR="${BACKUP_DIR:-/mnt/storage/backups}"
mkdir -p "$OUT_DIR"
ts=$(date -u +%F)
pg_dump dashboard | gzip > "$OUT_DIR/dashboard-$ts.sql.gz"
find "$OUT_DIR" -name 'dashboard-*.sql.gz' -mtime +14 -delete
