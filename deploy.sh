#!/bin/bash
# Description:
#   Default (no args): backs up ./web-prod, keeps last 5 backups, and syncs ./web/dist -> ./web-prod (deleting extras)
#   Prerequisite: run `npm run build` so ./web/dist exists (Vite production output).
#   Options:
#     --list-backups            : list available backups (newest first)
#     --restore latest          : restore from the most recent backup (asks confirmation)
#     --restore <ts|path>       : restore a specific backup by timestamp or file path (asks confirmation)
#     --yes                     : skip confirmation
#     --dry-run                 : simulate actions without making changes
#
# Backups live in ./backups as web-prod-backup-<timestamp>.tar.gz

set -euo pipefail

# === Configuration ===
SRC="./web/dist"
DEST="./web-prod"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_PATH="$BACKUP_DIR/web-prod-backup-$TIMESTAMP.tar.gz"
YES_MODE=false
DRY_RUN=false

# === Colors ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# === Helpers ===
require() {
  command -v "$1" >/dev/null 2>&1 || { echo -e "${RED}❌ '$1' is required but not installed.${NC}"; exit 1; }
}

say() {
  local color="$1"; shift
  echo -e "${color}$*${NC}"
}

confirm_action() {
  if [ "$YES_MODE" = true ]; then return 0; fi
  read -rp "⚠️  Are you sure you want to continue? [y/N]: " reply
  case "$reply" in
    [Yy]*) return 0 ;;
    *) say "$RED" "❌ Operation cancelled."; exit 1 ;;
  esac
}

list_backups() {
  shopt -s nullglob
  local files=("$BACKUP_DIR"/web-prod-backup-*.tar.gz)
  if (( ${#files[@]} == 0 )); then
    say "$YELLOW" "ℹ️ No backups found in $BACKUP_DIR"
    return 0
  fi
  say "$BLUE" "📚 Available backups (newest first):"
  ls -1t "${files[@]}"
}

latest_backup() {
  shopt -s nullglob
  local c=("$BACKUP_DIR"/web-prod-backup-*.tar.gz)
  shopt -u nullglob
  ((${#c[@]} == 0)) && return
  ls -1t "${c[@]}" 2>/dev/null | head -n 1 || true
}

backup_dest_if_needed() {
  mkdir -p "$BACKUP_DIR"
  if [ -n "$(ls -A "$DEST" 2>/dev/null || true)" ]; then
    say "$BLUE" "🗄️  Backing up '$DEST' -> $BACKUP_PATH"
    if [ "$DRY_RUN" = false ]; then
      tar -czf "$BACKUP_PATH" -C "$DEST" .
    else
      echo "(dry-run) would create: $BACKUP_PATH"
    fi
    say "$GREEN" "✅ Backup complete: $BACKUP_PATH"
  else
    say "$YELLOW" "ℹ️ No content in '$DEST' to back up."
  fi
}

cleanup_old_backups() {
  say "$BLUE" "🧾 Cleaning old backups (keeping last 5)…"
  shopt -s nullglob
  local candidates=("$BACKUP_DIR"/web-prod-backup-*.tar.gz)
  shopt -u nullglob
  if (( ${#candidates[@]} == 0 )); then
    say "$YELLOW" "ℹ️ Nothing to clean."
    return
  fi
  local files=()
  mapfile -t files < <(ls -1t "${candidates[@]}" 2>/dev/null || true)
  if (( ${#files[@]} > 5 )); then
    local n_remove=$(( ${#files[@]} - 5 ))
    if [ "$DRY_RUN" = false ]; then
      printf '%s\0' "${files[@]:5}" | xargs -0 rm --
      say "$GREEN" "🧹 Removed $n_remove old backup(s)."
    else
      echo "(dry-run) would remove $n_remove old backup(s)"
    fi
  else
    say "$YELLOW" "ℹ️ Nothing to clean."
  fi
}

sync_source_to_dest() {
  require rsync
  [ -d "$SRC" ] || { say "$RED" "❌ Source '$SRC' does not exist. Run: npm run build${NC}"; exit 1; }
  mkdir -p "$DEST"
  say "$BLUE" "🔄 Syncing $SRC -> $DEST"
  if [ "$DRY_RUN" = false ]; then
    rsync -a --delete "$SRC"/ "$DEST"/
  else
    rsync -a --delete --dry-run "$SRC"/ "$DEST"/
  fi
  say "$GREEN" "✅ Sync complete."
}

restore_from_file() {
  local archive="$1"
  [ -f "$archive" ] || { say "$RED" "❌ Backup file not found: $archive"; exit 1; }
  say "$BLUE" "🗄️  Creating safety backup of current '$DEST' before restore…"
  backup_dest_if_needed
  confirm_action
  say "$YELLOW" "🧹 Clearing destination before restore: $DEST"
  mkdir -p "$DEST"
  if [ "$DRY_RUN" = false ]; then
    rm -rf "${DEST:?}/"*
    say "$BLUE" "📦 Restoring from: $archive"
    tar -xzf "$archive" -C "$DEST"
  else
    echo "(dry-run) would clear $DEST and extract $archive"
  fi
  say "$GREEN" "✅ Restore complete."
}

restore_from_arg() {
  local arg="$1"
  if [[ "$arg" == *.tar.gz ]] || [ -f "$arg" ]; then
    restore_from_file "$arg"
    return
  fi
  local candidate="$BACKUP_DIR/web-prod-backup-$arg.tar.gz"
  restore_from_file "$candidate"
}

deploy_flow() {
  require tar
  mkdir -p "$DEST" "$BACKUP_DIR"
  backup_dest_if_needed
  cleanup_old_backups
  sync_source_to_dest
  say "$GREEN" "📦 Latest backup: $BACKUP_PATH"
}

# === Argument parsing ===
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --yes) YES_MODE=true ;;
    --dry-run) DRY_RUN=true ;;
    *) POSITIONAL+=("$arg") ;;
  esac
done
set -- "${POSITIONAL[@]}"

case "${1-}" in
  --list-backups)
    list_backups
    ;;
  --restore)
    shift || true
    if [ "${1-}" = "latest" ]; then
      bkp=$(latest_backup)
      [ -n "$bkp" ] || { say "$RED" "❌ No backups available to restore."; exit 1; }
      say "$YELLOW" "↩️  Preparing to restore latest backup: $bkp"
      restore_from_file "$bkp"
    elif [ -n "${1-}" ]; then
      say "$YELLOW" "↩️  Preparing to restore backup: $1"
      restore_from_arg "$1"
    else
      say "$RED" "Usage: $0 --restore latest | --restore <timestamp|/path/to/backup.tar.gz> [--yes] [--dry-run]"
      exit 1
    fi
    ;;
  "" )
    deploy_flow
    ;;
  * )
    say "$YELLOW" "Usage:"
    echo "  $0                     # backup, clean old, sync"
    echo "  $0 --list-backups      # list backups"
    echo "  $0 --restore latest    # restore most recent backup"
    echo "  $0 --restore <file|ts> # restore specific backup"
    echo "  Add --yes to skip confirmation, --dry-run to simulate actions"
    exit 1
    ;;
esac
