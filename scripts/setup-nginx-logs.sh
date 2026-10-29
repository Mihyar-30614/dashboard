#!/usr/bin/env bash
# Gives each app its own access log in the format the dashboard's Traffic
# widget parses (config/nginx/observatory-log.conf). Idempotent; backs up
# every file it touches and rolls back if `nginx -t` fails.
#   sudo bash scripts/setup-nginx-logs.sh
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "run with sudo" >&2; exit 1; }

HERE="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP="/etc/nginx/observatory-backup-$(date +%Y%m%d-%H%M%S)"
# site config (in sites-enabled) -> log slug the dashboard reads (config/apps.json)
declare -A SITES=(
  [sportly.ca.conf]=sportly
  [honeydoeh.mihyarmas.com.conf]=honeydoeh
  [debt-manager.mihyarmas.com.conf]=debtmanager
)

mkdir -p "$BACKUP"
restore() {
  echo "nginx -t failed; restoring from $BACKUP" >&2
  for site in "${!SITES[@]}"; do
    [[ -f "$BACKUP/$site.path" ]] && cp -a "$BACKUP/$site" "$(cat "$BACKUP/$site.path")"
  done
  if [[ -f "$BACKUP/conf.d-observatory-log.conf.absent" ]]; then
    rm -f /etc/nginx/conf.d/observatory-log.conf
  fi
  nginx -t
  exit 1
}

if [[ ! -f /etc/nginx/conf.d/observatory-log.conf ]]; then
  touch "$BACKUP/conf.d-observatory-log.conf.absent"
fi
cp "$HERE/config/nginx/observatory-log.conf" /etc/nginx/conf.d/observatory-log.conf

for site in "${!SITES[@]}"; do
  slug="${SITES[$site]}"
  # sites-enabled entries are symlinks; edit the real file so the link survives.
  real="$(readlink -f "/etc/nginx/sites-enabled/$site")"
  if grep -q "$slug.access.log observatory" "$real"; then
    echo "skip  $site (already logging to $slug.access.log)"
    continue
  fi
  cp -a "$real" "$BACKUP/$site"
  echo "$real" > "$BACKUP/$site.path"
  # Add both lines right after server_name in the `listen 443` block: a
  # server-level access_log replaces the http-level one, so keep the shared log.
  awk -v slug="$slug" '
    /listen[^;]*443/ { in443 = 1 }
    { print }
    in443 && !done && /^[ \t]*server_name/ {
      match($0, /^[ \t]*/); ind = substr($0, 1, RLENGTH)
      print ind "access_log /var/log/nginx/access.log;"
      print ind "access_log /var/log/nginx/" slug ".access.log observatory;"
      done = 1
    }' "$BACKUP/$site" > "$real"
  echo "edit  $site -> /var/log/nginx/$slug.access.log"
done

nginx -t || restore
systemctl reload nginx
echo "reloaded nginx; backups in $BACKUP"
