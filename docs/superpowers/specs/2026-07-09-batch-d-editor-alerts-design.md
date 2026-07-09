# Batch D: SQL editor upgrades + health email alerts

Approved 2026-07-09. Channel: email (mirroring HoneyDoEh's nodemailer
setup). Rules: auto from existing config — no rules UI.

## 1. SQL widget editor: schema tree + highlighting

**Server:** `GET /api/sql-widgets/schema?data_source=X` (admin). Reads
`information_schema.columns` through the existing read-only pool and
returns the analytics `SchemaInfo` shape (`{ db_name, tables,
schemas }`), so the Ask DB `SchemaTree` component renders it unchanged.
Avoids the seer name mismatch (`debtmanager` vs `debtapp`) entirely.

**Web:** in the SQL widget editor drawer:
- CodeMirror (`@uiw/react-codemirror` + `@codemirror/lang-sql`) replaces
  the plain textarea; theme follows the app via CSS variables.
- `SchemaTree` panel under the data-source select, fed by the new
  endpoint; clicking a column inserts its name at the cursor.

## 2. Health email alerts

Auto rule: an app is DOWN after 3 consecutive failed health ticks
(~90s at the 30s cadence); UP on the first healthy tick while in DOWN.
Both transitions send email. KPI alerts deferred — `apps.json` KPIs
carry no targets today; a later `alert` block there can enable them.

- `server/mailer.js` — nodemailer transport from `SMTP_HOST/PORT/SECURE/
  USER/PASS`, `FROM_EMAIL`, `FROM_EMAIL_NAME` (HoneyDoEh conventions),
  recipient `ALERT_EMAIL` (default `ADMIN_EMAIL`). Unconfigured → warn
  once at boot, alerts become log-only.
- `server/alerts.js` — pure `computeTransition(status, ok, failCount,
  threshold)`; `handleHealthSample(slug, ok)` keeps in-memory
  consecutive-fail counts and persists status to a new `alert_state`
  table (`app_slug pk, status, changed_at`) so restarts don't re-alert.
- Poller calls `handleHealthSample` beside the existing `health_ok`
  persist.
- `schema.sql` gains `alert_state`; table also created on the live DB.

**Tests:** transition table (stays up, down after threshold, recovery,
no repeat alerts); handleHealthSample with mocked mailer and db;
schema endpoint returns SchemaInfo shape and 400s unknown sources.
