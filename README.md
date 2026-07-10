# Dashboard

Self-hosted operations dashboard that aggregates metrics from monitored applications. A **React / Vite** frontend (`web`) talks to an **Express** API (`server`) that reads app Postgres databases (read-heavy metrics), optional **nginx** access logs, and **PM2** process snapshots. Auth is invite-based with cookie sessions; administrators can compose layouts and SQL-backed widgets toward configured data sources.

## Stack

| Area        | Choice |
|------------|--------|
| Runtime    | Node.js (ECMAScript modules) |
| API        | Express, PostgreSQL (`pg`), morgan logging |
| Web        | React 18, TypeScript, Vite, TanStack Query, Gridstack, Recharts |

## Repo layout

- **`server/`** — HTTP API, poller background job, collectors (Postgres KPIs/users/activity, health checks, nginx, PM2).
- **`web/`** — SPA source; **`web/dist`** is the default Vite output (gitignored built assets).
- **`web-prod/`** — Assets the production server serves; populate from your build output (typically copy or rsync **`web/dist`** → **`web-prod/`**). Directory is gitignored.
- **`config/apps.json`** — Per-app labels, DB connection info, metric SQL snippets, HTTP health URLs, PM2 names, nginx log paths.
- **`config/widgets.json`** — Shared widget catalog (kinds, sizes, scopes); used by server validation and the web registry.
- **`config/data_sources.json`** — Read-only Postgres roles used by SQL widgets (passwords separate — see Configuration).
- **`tests/`** — All tests: `tests/server/` (API Vitest), `tests/web/` (component Vitest), `tests/e2e/` (Playwright), `tests/setup/` (shared fixtures), `tests/fixtures/` (sample data).

## Prerequisites

- Node.js compatible with dependencies (current setup targets recent LTS, e.g. 20.x).
- A **dashboard** Postgres database (credentials in `.env`) for sessions, layouts, metric history, invites, SQL widget definitions, etc. Create it from the committed snapshot: `createdb dashboard && psql dashboard < schema.sql` (regenerate `schema.sql` after schema changes — see its header).
- Access to monitored app databases plus, if enabled, **`pm2`** and nginx log directories on the host (paths configurable).

## Getting started

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Environment** — Copy the example env and fill values:

   ```bash
   cp .env.example .env
   ```

   See `.env.example` for dashboard DB, sessions, first-admin bootstrap (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, then run `npm run seed:admin`), `DASHBOARD_READER_PASSWORD` (shared `dashboard_reader` password for app DBs), and optional poller-related paths (`PM2_BIN`, `NGINX_LOG_DIR`).

   For local dev the browser talks to **Vite** on **`http://localhost:4210`**, which proxies `/api` to the API. Set **`APP_ORIGIN`** to include that origin so non-GET API requests from Vite succeed (comma-separated origins if you need multiple).

3. **Run**

   ```bash
   # API only (defaults to dev port derived from `.env`; often 4110)
   npm run backend:dev

   # SPA only — http://localhost:4210 — proxies `/api` to localhost:4110
   npm run dev

   # Both in one terminal
   npm run dev:all
   ```

   To disable metric polling locally: `POLLER=off npm run backend:dev`.

### Production-ish local run

```bash
npm run build                         # emits web/dist
# Copy static assets into web-prod on the server (paths/policies are host-specific).
rsync -a --delete web/dist/ web-prod/
NODE_ENV=production npm start         # serves web-prod + API on PORT (default 4010)
```

PM2 is optional; if you use it, keep an `ecosystem.config.cjs` locally (this file is gitignored so machine-specific paths do not land in the repo).

## Configuration notes

- **`DASHBOARD_READER_PASSWORD`** — Password for the shared `dashboard_reader` role on app databases (`config/apps.json` monitoring + `config/data_sources.json` SQL widgets). Set this to the same value used in `scripts/grant-readers.sh`.
- **`POLLER=off`** — Skips starting the background poller (useful for tests or API-only runs).

- **`scripts/`** — `seed-admin.js`, shell helpers (`backup.sh`, `grant-readers.sh`).

## Tests

Server tests use a separate test database. Copy the example env before running:

```bash
cp .env.test.example .env.test
# create dashboard_test if needed: createdb dashboard_test && psql dashboard_test < schema.sql
npm test              # server + web unit tests
npm run test:watch    # both in watch mode
npm run test:e2e      # Playwright (starts API + Vite automatically)
```

Tests live under **`tests/`** — `tests/server/`, `tests/web/`, `tests/e2e/`, plus `tests/setup/` and `tests/fixtures/`.

## Useful scripts (root `package.json`)

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run backend:dev` | API with `node --watch` |
| `npm run dev:all` | API + Vite via `concurrently` |
| `npm run build` | Production web build |
| `npm start` | Production API + static `web-prod` |
| `npm run seed:admin` | Bootstrap admin user (see script / env) |
| `npm test` | Server + web Vitest |
| `npm run test:watch` | Vitest watch (server + web) |
| `npm run test:e2e` | Playwright E2E |

Automate syncing **`web/dist`** into **`web-prod/`** with whatever fits your hosts (cron, systemd, etc.).

## License

Private project (`"private": true` in `package.json`); add a license file if you publish or share the repo.
