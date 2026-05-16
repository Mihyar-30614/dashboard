# Apps Dashboard — Design Spec

**Date:** 2026-05-16
**Status:** Draft, pending plan
**Owner:** mihyar

## 1. Goal

A self-hosted web dashboard at `/mnt/storage/apps/dashboard/` that monitors the user's local apps (`Sportly`, `HoneyDoEh`, `DebtManager`). Surfaces user counts, activity (DAU/WAU/MAU), uptime, request/error/latency metrics, and per-app domain KPIs. Layout is user-customizable via a draggable widget grid.

### v1 scope

- 3 DB-backed apps: Sportly, HoneyDoEh, DebtManager.
- Battleships excluded (no DB, no persistent users). Static apps (mihyarmas, qestha) excluded.
- Metric bundles: Users, Activity, Health, Domain KPIs.
- Single admin (invite-only for additional users).
- Polled refresh, 30s interval. No live websocket.
- Light + dark theme. Per-user theme persisted in localStorage.
- Draggable Gridstack canvas on overview screen + per-app screens. Per-user layout saved in dashboard DB.

### Non-goals (v1)

Alerting/paging, email delivery, multi-tenant orgs, mobile app, custom SQL editor, log search, websocket live updates.

## 2. Approach

**Strategy: pull-only.** Dashboard reads each app's Postgres directly (read-only role), polls PM2 via `pm2 jlist`, tails nginx access logs. Zero changes to monitored apps. Shared product-event logger lib deferred to a later phase; metrics that would benefit from it (real login events, feature use) are approximated from `refresh_tokens.last_used_at` and row counts in v1.

## 3. Architecture

```
Browser (React + Vite + Gridstack)
  Overview screen + per-app screen (3) — each a grid of widgets
        │  HTTPS, cookie session, polled 30s
Dashboard API (Express, port 4010 prod, 4110 dev)
  /api/auth, /api/apps, /api/metrics/:kind, /api/layouts, /api/widgets
  Background poller (30s): pm2 jlist, healthchecks, nginx tail
  In-memory LRU cache (30s TTL per metric key)
        │ pg read-only per app │ shell pm2 │ fs nginx logs
Sportly DB · HoneyDoEh DB · DebtManager DB
Dashboard DB (Postgres): users, sessions, invites, dashboard_layouts, metric_samples
```

- Express serves built Vite assets from `web/dist` + JSON API at `/api/*`.
- Each monitored app gets a `dashboard_reader` Postgres role with `SELECT` only.
- Single PM2 process: `dashboard`.

## 4. Data model (Dashboard DB)

```sql
CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE sessions (
  id            UUID PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  user_agent    TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_exp  ON sessions(expires_at);

CREATE TABLE invites (
  id            BIGSERIAL PRIMARY KEY,
  token         TEXT UNIQUE NOT NULL,
  email         TEXT,
  created_by    BIGINT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ
);

CREATE TABLE dashboard_layouts (
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  screen        TEXT NOT NULL, -- 'overview' | app slug
  layout        JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, screen)
);

CREATE TABLE metric_samples (
  app_slug      TEXT NOT NULL,
  metric        TEXT NOT NULL,
  value         DOUBLE PRECISION NOT NULL,
  taken_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_samples_lookup ON metric_samples(app_slug, metric, taken_at DESC);
```

### Widget instance shape (element of `dashboard_layouts.layout`)

```json
{
  "id": "w_8f3a",
  "kind": "signups_timeseries",
  "app": "sportly",
  "x": 0, "y": 0, "w": 6, "h": 4,
  "params": { "range": "30d", "bucket": "day" }
}
```

### `config/apps.json` (committed)

```json
{
  "sportly": {
    "label": "Sportly",
    "db": { "host": "localhost", "port": 5432, "database": "sportly", "user": "dashboard_reader" },
    "health_url": "http://localhost:4003/health",
    "pm2_name": "sportly-backend",
    "nginx_log": "/var/log/nginx/sportly.access.log",
    "kpis": [
      { "key": "events_week",       "label": "Events (7d)",       "sql": "SELECT COUNT(*) FROM events WHERE created_at > NOW() - INTERVAL '7 days'" },
      { "key": "participants_week", "label": "Participants (7d)", "sql": "SELECT COUNT(*) FROM event_participants WHERE created_at > NOW() - INTERVAL '7 days'" }
    ]
  }
}
```

KPI SQL is hand-curated per app. DB password is referenced by key in `APP_DB_PASSWORDS_JSON` env var, never inline.

## 5. Backend

### Directory layout

```
dashboard/
├── ecosystem.config.cjs
├── config/apps.json
├── server/
│   ├── index.js
│   ├── db.js
│   ├── appPools.js
│   ├── auth/{routes.js,session.js,invites.js}
│   ├── routes/{apps.js,metrics.js,layouts.js,widgets.js}
│   ├── collectors/{pgUsers.js,pgActivity.js,pgKpi.js,pm2.js,health.js,nginx.js}
│   ├── poller.js
│   ├── cache.js
│   └── widgets/registry.js
├── web/
├── migrations/
└── scripts/{migrate.js,seed-admin.js,grant-readers.sh}
```

### Endpoints (all behind session cookie)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | email+password → cookie session |
| POST | `/api/auth/logout` | clear session |
| POST | `/api/auth/accept-invite` | invite token → set password, return session |
| GET  | `/api/auth/me` | current user |
| POST | `/api/invites` | create invite (admin) |
| GET  | `/api/invites` | list outstanding (admin) |
| DELETE | `/api/invites/:id` | revoke (admin) |
| GET  | `/api/apps` | `[{slug,label,status,last_seen,port,pm2_name}]` |
| GET  | `/api/widgets` | widget registry for palette |
| GET  | `/api/metrics/:kind?app=...&range=30d&bucket=day&key=...` | dispatch to collector |
| GET  | `/api/layouts/:screen` | user's saved layout (default if none) |
| PUT  | `/api/layouts/:screen` | save layout JSON |
| GET  | `/health` | liveness, no auth |
| GET  | `/api/_internal/poller` | poller stats (admin) |

### Metric kinds dispatch

```js
const KINDS = {
  users_total:        { collector: 'pgUsers',    fn: 'total' },
  signups_timeseries: { collector: 'pgUsers',    fn: 'timeseries' },
  dau:                { collector: 'pgActivity', fn: 'dau' },
  active_timeseries:  { collector: 'pgActivity', fn: 'timeseries' },
  health:             { collector: 'health',     fn: 'current' },
  pm2:                { collector: 'pm2',        fn: 'current' },
  http_rate:          { collector: 'nginx',      fn: 'rate' },
  http_errors:        { collector: 'nginx',      fn: 'errors' },
  http_latency:       { collector: 'nginx',      fn: 'latency_p95' },
  kpi:                { collector: 'pgKpi',      fn: 'value' },
  kpi_timeseries:     { collector: 'pgKpi',      fn: 'timeseries' }
};
```

### Poller loop (30s)

1. `pm2 jlist` once, fanout to all apps.
2. Per app in parallel: healthcheck, `pgActivity.dau`, `pgKpi.value` for each configured key.
3. Tail nginx logs since last tick, aggregate request count, error count, latency.
4. Write each value to `cache` (key = `${kind}:${app}:${params}`). Push headline metrics (`users_total`, `dau`, `p95`) to `metric_samples`.
5. Trim `metric_samples` rows older than 90 days — runs once per day inside the server process via a 24h `setInterval` (no external cron). First trim 5 minutes after boot.

### Cache rule

GET handlers read cache only. Cache miss → on-demand fetch, populate, return. Prevents request stampede on slow queries. Timeseries reads `metric_samples` directly (bypasses live cache for historical data).

## 6. Frontend

### Stack

React 18 + Vite + TypeScript. Gridstack (manual mount, no React wrapper). Recharts. TanStack Query. CSS variables for theme. No UI framework.

### Directory layout

```
web/
├── index.html
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── theme.css
    ├── theme.ts
    ├── api/{client.ts,hooks.ts}
    ├── auth/Login.tsx
    ├── layout/{Shell.tsx,Sidebar.tsx}
    ├── pages/{Overview.tsx,AppPage.tsx,Settings.tsx}
    ├── grid/{GridCanvas.tsx,WidgetFrame.tsx,EditModeBar.tsx,WidgetPalette.tsx}
    └── widgets/
        ├── registry.ts
        ├── SignupsTimeseries.tsx
        ├── UsersTotal.tsx
        ├── DauCard.tsx
        ├── ActiveTimeseries.tsx
        ├── HealthCard.tsx
        ├── Pm2Card.tsx
        ├── HttpRate.tsx
        ├── HttpErrors.tsx
        ├── HttpLatency.tsx
        ├── KpiCard.tsx
        └── KpiTimeseries.tsx
```

### Widget contract

```ts
type WidgetProps = {
  app?: string;
  params: Record<string, unknown>;
};
type WidgetDef = {
  kind: string;
  label: string;
  description: string;
  defaultSize: { w: number; h: number };
  paramsSchema: Param[];
  Component: React.FC<WidgetProps>;
  scope: 'app' | 'overview' | 'both';
};
```

### Data fetching

Each widget calls `useMetric(kind, { app, ...params })`. TanStack Query: `staleTime: 25_000`, `refetchInterval: 30_000`. Dedupes identical keys across widgets. Any 401 → `/login` with `?next=` preserved.

### Edit mode

1. EditModeBar **Edit** → Gridstack enables move + resize, widgets show delete handle.
2. **Add widget** → palette drawer opens with registry filtered by current screen scope.
3. Drag from palette → drops with `defaultSize`. Widget in "configure" state if `paramsSchema` not satisfied.
4. **Save** → `PUT /api/layouts/:screen` with current node list. **Cancel** → reload from server.

### Default layouts

If a user has no row in `dashboard_layouts` for a screen, server returns a curated default (overview: apps grid + global signups; per-app: users total + DAU + signups + KPIs).

### Theme

`theme.css` defines `--bg`, `--panel`, `--text`, `--muted`, `--accent`, `--grid-line`, `--chart-1..6` under `:root` (light) and `[data-theme="dark"]`. Recharts reads colors via `getComputedStyle` on mount and on theme change. Toggle in Shell top-right. Persisted to `localStorage.theme`. First load respects `prefers-color-scheme`.

## 7. Auth flow

### Bootstrap

`npm run seed:admin` reads `ADMIN_EMAIL` + `ADMIN_PASSWORD` from `.env`, creates first user with `is_admin=true`. Refuses if any user already exists. No public signup route.

### Login

1. UI `POST /api/auth/login` `{ email, password }`.
2. bcrypt-compare against `users.password_hash`. Rate limit: 5 attempts / 15 min / IP.
3. Insert `sessions` row (UUID, `expires_at = NOW() + 30d`), set cookie: `ds=<uuid>; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=2592000`.
4. Update `users.last_login_at`.

### Session middleware

Lookup `ds` cookie joined to `users` where active + not expired. 60s in-memory cache per session id. Sliding expiry: if session age > 7d, rotate id and extend `expires_at`. Missing/invalid → 401.

### Logout

`DELETE FROM sessions WHERE id=$1`, clear cookie.

### Invites

- `POST /api/invites` `{ email? }` → 32-byte hex token, 7d TTL. Returns URL `https://<host>/accept-invite?token=...`. No email delivery in v1; copy by hand.
- `POST /api/auth/accept-invite` `{ token, email, password }`: validate token, bcrypt hash (cost 12), insert user (non-admin, active), mark `used_at`, return session.
- Admin endpoints to list and revoke.

### CSRF

SameSite=Lax cookie. No GET state mutations. Mutating endpoints assert `Origin` matches `APP_ORIGIN` env, reject with 403.

### Password rules

Min 12 chars. Reject passwords found in a bundled top-10k common-password list (e.g. `common-passwords` npm package or static file in repo). Re-bcrypt on login if stored hash cost < current target (default cost 12).

## 8. Deployment + config + ops

### Env vars (`.env.example`)

```
NODE_ENV=development
PORT=4010
PORT_DEV=4110
APP_ORIGIN=http://localhost:4110
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dashboard
DB_USER=dashboard
DB_PASSWORD=
SESSION_COOKIE_NAME=ds
SESSION_TTL_DAYS=30
ADMIN_EMAIL=
ADMIN_PASSWORD=
APP_DB_PASSWORDS_JSON={"sportly":"...","honeydoeh":"...","debtmanager":"..."}
PM2_BIN=/usr/local/bin/pm2
NGINX_LOG_DIR=/var/log/nginx
```

### PM2

```js
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'dashboard',
    script: 'server/index.js',
    cwd: __dirname,
    env: { NODE_ENV: 'production', PORT: 4010 },
    max_memory_restart: '300M',
    log_file: 'logs/dashboard.log',
    time: true
  }]
};
```

### Nginx (reference snippet)

```
location / {
  proxy_pass http://127.0.0.1:4010;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Read-only roles (run once per monitored app DB)

```sql
CREATE ROLE dashboard_reader LOGIN PASSWORD '<from APP_DB_PASSWORDS_JSON>';
GRANT CONNECT ON DATABASE <appdb> TO dashboard_reader;
GRANT USAGE ON SCHEMA public TO dashboard_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dashboard_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO dashboard_reader;
```

`scripts/grant-readers.sh` emits this parametrized per app DB.

### Build + run (prod)

```
npm install
npm run migrate
npm run seed:admin
npm run build
pm2 start ecosystem.config.cjs && pm2 save
```

### Dev

`npm run dev` runs concurrently: server nodemon on `4110`, vite dev server on `5174` with `/api` proxied to `4110`. Hot reload web, auto-restart server.

### `APPS_AND_PORTS.md` update

Add row:

```
| dashboard | dashboard | dashboard/ | 4010 (web+api) |
```

and include in the quick matrix.

### Logging

- HTTP: morgan combined → `logs/access.log`.
- App: pino JSON → `logs/error.log`.
- Poller logs each tick summary (apps polled, ms, errors).
- No request bodies, no PII.

### Backup

Nightly `pg_dump` of dashboard DB → `/mnt/storage/backups/dashboard-YYYY-MM-DD.sql.gz`, retain 14 days. Set up via user crontab entry (sample shipped in `scripts/backup.sh`); not managed by the Node process. Monitored app DBs are backed up by their own setup — dashboard never writes them.

## 9. Error handling

### Backend

- Per-collector timeout: 5s. On timeout/error, collector returns `{ error: 'timeout'|'unreachable'|'sql_error', message }`. Cache stores error for 10s.
- Per-app pg pool: `max: 5`, `idleTimeoutMillis: 30000`. Pool errors bubble as collector error.
- Metrics route returns 200 with `{ data, stale?, error? }`. Widget renders error state without blanking the grid.
- Poller wraps each app in try/catch — one failure does not stop the tick.
- `pm2 jlist` failure → all apps `pm2_status: 'unknown'`. Healthcheck continues independently.
- Unreadable nginx log → log warning once, http_* metrics marked unavailable.
- 5xx → JSON `{ error: 'internal' }`, detail to `logs/error.log` only.

### Frontend

- Widget error: red badge top-right, hover for message. Chart shows last good value with "stale" badge or "—".
- Offline → toast "Disconnected · retrying", TanStack Query auto-retries with backoff.
- Layout save failure → stay in edit mode, toast "Save failed · retry", do not overwrite server state.
- 401 anywhere → `/login?next=<path>`.

## 10. Testing

| Layer | Tool | Scope |
|---|---|---|
| Server unit | Vitest | collectors (mock pg/fs/child_process), cache, registry, layout validator |
| Server integration | Vitest + test pg | auth flow, layouts CRUD, metrics dispatch |
| SQL safety | Vitest | `apps.json` KPI queries parse + execute against fixture DB; readonly role denies INSERT |
| Web component | Vitest + Testing Library | each widget: data/error/loading states |
| Web e2e | Playwright | login → load overview → edit → drag widget → save → reload persists |
| Smoke | shell | curl `/health`, `/api/apps` (cookie) returns expected slugs |

TDD applies per `superpowers:test-driven-development`: new collector / widget kind / route lands test-first.

## 11. Observability of the dashboard itself

- `GET /health` (no auth): `{ ok, version, uptime_s }`.
- `GET /api/_internal/poller` (admin): last tick timing per app, errors, cache size.
- Logs covered in §8.

## 12. Performance budget

- Poll tick wall time target p95 < 2s across 3 apps. Log warn if > 5s.
- Page load p95 < 1s on local network with cache warm.
- API JSON payload per widget < 50KB; timeseries downsampled server-side to ≤ 200 points.

## 13. Decisions log

- Pull-only v1, push-event logger lib deferred to a later phase.
- Scope = 3 DB-backed apps (Sportly, HoneyDoEh, DebtManager).
- All 4 metric bundles in v1; Domain KPIs configurable via `config/apps.json`.
- Polled 30s, no websocket.
- Own users table; single admin seeded; invite-only for others.
- React + Vite + TS frontend; Express + pg backend; single PM2 process port 4010 (dev 4110).
- Sidebar nav layout; Gridstack on overview + per-app screens; per-user layout persisted in DB.
- Light + dark theme.
