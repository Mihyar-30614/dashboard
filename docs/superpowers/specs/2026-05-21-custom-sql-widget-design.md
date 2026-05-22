# Custom SQL Widget — Design

**Date:** 2026-05-21
**Status:** Draft (awaiting user review)

## Goal

Let admins author dashboard widgets backed by arbitrary read-only SQL against any
configured Postgres data source. Saved widgets appear in the regular widget palette
and render on the Overview or AppPage according to their data source's scope.

This unlocks ad-hoc KPIs, breakdowns, and tables without code changes or server
restarts, while preserving the safety, caching, and layout semantics of the existing
widget system.

## Decisions (Q&A)

1. **Author scope:** admin only (`users.is_admin = true`).
2. **Targets:** per-app pools, dashboard pool, and any future data sources, via a
   generic named-pool registry. No hardcoded enum.
3. **Visualization choice:** SQL author selects from a menu; the server infers a
   sensible default from the result shape and the UI pre-fills it.
4. **Viz catalog v1:** number, line, bar, table. (No pie. No stacked/multi-series
   beyond multiple `yCol` values on line/bar.)
5. **Read-only enforcement:** dedicated read-only Postgres role per data source
   *plus* a read-only transaction wrapper at execution time. Defense in depth.
6. **Parameters:** built-in `:range_days` only, bound to the existing 7d/30d/90d
   range picker. No author-defined params in v1.
7. **Storage:** new `sql_widgets` table in the dashboard pool. CRUD via UI. No
   config file edits, no server restart.
8. **Palette scope:** auto-derived from data source — dashboard pool → Overview,
   app pool → that app's page only.
9. **Authoring flow:** preview is required before save. Save button gated on a
   successful preview matching the current SQL.

## Architecture

Three pieces:

1. **Data source registry** (`server/dataSources.js`) — loads named pools from
   `config/data_sources.json`, exposes `listDataSources()` and
   `getReadOnlyPool(name)`. Used by both preview and run paths.
2. **SQL widget store + API** (`server/routes/sqlWidgets.js` + migration
   `002_sql_widgets.sql`) — CRUD, preview, run.
3. **Front-end** — one `SqlWidget` dispatcher and four viz components, an admin
   authoring page at `/settings/sql-widgets`, and palette merging on Overview /
   AppPage.

The render contract is `{ columns, rows, truncated, durationMs }`. The server
returns raw rows; the client decides how to visualize.

## Section 1 — Data Source Registry

### Config

`config/data_sources.json` (new):

```json
{
  "dashboard": {
    "kind": "dashboard",
    "scope": "overview",
    "db_ro": {
      "host": "localhost",
      "port": 5432,
      "database": "dashboard",
      "user": "dashboard_ro"
    }
  },
  "sportly": {
    "kind": "app",
    "app_slug": "sportly",
    "scope": "app",
    "db_ro": {
      "host": "localhost",
      "port": 5432,
      "database": "sportly",
      "user": "sportly_ro"
    }
  }
}
```

Passwords come from a new env variable `DATA_SOURCE_RO_PASSWORDS_JSON`
(structured like the existing `APP_DB_PASSWORDS_JSON`), keyed by data source
name. The `dashboard` entry is auto-created from existing `DB_*` env vars if
omitted from the JSON. All other data sources — including per-app pools — must
be declared explicitly in `data_sources.json`. There is no implicit derivation
from `apps.json`; the two configs are independent, since an app's main DB user
must not be used for SQL widget execution.

### Module

`server/dataSources.js`:

- `listDataSources()` → array of `{ name, kind, scope, app_slug? }`. No
  credentials returned.
- `getReadOnlyPool(name)` → cached `pg.Pool`, `max: 5`,
  `idleTimeoutMillis: 30_000`, `connectionTimeoutMillis: 5_000`. Pool created
  lazily on first use.
- `closeAllReadOnlyPools()` for shutdown symmetry with `closeAllPools()`.

### DB role setup (manual, documented)

Each data source requires the DBA to create a read-only role. Documented in
`docs/data-sources.md`:

```sql
CREATE ROLE <name>_ro NOINHERIT LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE <db> TO <name>_ro;
GRANT USAGE ON SCHEMA public TO <name>_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO <name>_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO <name>_ro;
```

The runtime never assumes the role exists; missing/incorrect grants surface as
clean Postgres errors at preview time.

## Section 2 — Storage Schema

Migration `migrations/002_sql_widgets.sql`:

```sql
CREATE TABLE IF NOT EXISTS sql_widgets (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  data_source  TEXT NOT NULL,
  sql          TEXT NOT NULL,
  viz          TEXT NOT NULL CHECK (viz IN ('number','line','bar','table')),
  options      JSONB NOT NULL DEFAULT '{}',
  created_by   BIGINT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sql_widgets_source ON sql_widgets(data_source);
```

### Fields

- `name` — palette label.
- `description` — palette hover text.
- `data_source` — name from the registry. No DB foreign key (registry lives in
  JSON); validated at the API layer.
- `sql` — author's query. Max 16 KB.
- `viz` — `number | line | bar | table`.
- `options` — viz-specific configuration:
  - `number`: `{ unit?: string, decimals?: number }`
  - `line` / `bar`: `{ xCol: string, yCol: string | string[] }`
  - `table`: `{ columns?: string[] }` (defaults to all columns)

### Layout reference

Existing `dashboard_layouts.layout` JSON stores `{kind, id, x, y, w, h}` per
cell. For SQL widgets, `kind = "sql"` and the cell includes `widget_id` pointing
to `sql_widgets.id`. The `id` grid key becomes `"sql:<widget_id>"`.

### Orphan handling

Deleting a `sql_widgets` row does **not** touch layouts. The front-end renders
cells with unknown `widget_id` as a clearly-labeled "deleted widget" tile with a
"remove from layout" button. This matches the existing behavior for KPI widgets
whose `kpis[]` entry was removed.

## Section 3 — Server API

New router `server/routes/sqlWidgets.js`, mounted at `/api/sql-widgets`.

### Endpoints

| Method | Path                              | Auth          | Purpose                              |
|--------|-----------------------------------|---------------|--------------------------------------|
| GET    | `/api/sql-widgets`                | requireAuth   | List all widgets (palette + admin)   |
| GET    | `/api/sql-widgets/sources`        | requireAuth   | List data sources (name, scope, app) |
| GET    | `/api/sql-widgets/:id`            | requireAuth   | Read one                             |
| POST   | `/api/sql-widgets`                | requireAdmin  | Create                               |
| PATCH  | `/api/sql-widgets/:id`            | requireAdmin  | Update                               |
| DELETE | `/api/sql-widgets/:id`            | requireAdmin  | Delete                               |
| POST   | `/api/sql-widgets/preview`        | requireAdmin  | Run un-saved SQL, return result      |
| GET    | `/api/sql-widgets/:id/run`        | requireAuth   | Execute saved widget                 |

`requireAdmin` is a new middleware in `server/auth/session.js` gated on
`req.user.is_admin`.

**Route registration order matters.** `/sources`, `/preview`, and `/:id/run`
must be registered before `/:id` so Express does not match the literal paths
against the `:id` parameter.

### Execution path

Both preview and run share a `executeSqlWidget(dataSource, sql, range)` helper.
Steps:

```text
1. Reject sql longer than 16 KB.
2. Reject sql containing ';' followed by any non-whitespace character (single
   statement only).
3. Substitute the literal token ':range_days' with '$1'. Reject any other
   ':<word>' tokens (no other params in v1).
4. Look up the data source in the registry; reject if unknown.
5. pool = getReadOnlyPool(dataSource)
6. client = await pool.connect()
7. await client.query('SET statement_timeout = 5000')
8. await client.query('SET default_transaction_read_only = on')
9. await client.query('BEGIN READ ONLY')
10. result = await client.query(rewrittenSql, [days])
11. await client.query('ROLLBACK')
12. client.release()
13. If result.rows.length > 1000, slice to 1000 and set truncated=true.
14. Return { columns: result.fields.map(f => f.name), rows, truncated,
              durationMs }
```

`days` is derived from the `range` parameter: `{ '7d': 7, '30d': 30,
'90d': 90 }`. Unknown range defaults to 30. If the SQL does not reference
`:range_days`, `range` is ignored.

### Errors

Any exception is caught and returned as `{ error: '<safe message>' }`. No stack
traces. Postgres error codes are mapped to short prefixes
(e.g., `read_only_txn`, `timeout`, `unknown_data_source`, `bad_sql`) so the UI
can show friendly text.

### Cache

Saved-widget `run` results are cached in the existing `metricsCache` under key
`sql:<id>:<range>` with the same 30-second TTL as other metrics. Preview is
never cached.

### Audit

Every preview and every saved-widget execution emits a `console.info` line:

```text
sql_widget event=<preview|run> actor=<email> ds=<name> id=<id?> rows=<n>
duration_ms=<n> sha=<sql_sha8> [error=<short>]
```

`sql_sha8` is the first 8 chars of `sha256(sql)`. No new audit table in v1;
upgrade path is straightforward.

## Section 4 — Front-End Widget Components

New components under `web/src/widgets/`:

- `SqlWidget.tsx` — dispatcher. Props: `{ widgetId, range }`. Fetches widget
  metadata from the palette cache (loaded once) and `/api/sql-widgets/:id/run`
  on mount and on `range` change. Renders the appropriate viz component.
- `SqlNumber.tsx` — first cell of first row. Honors `options.unit` and
  `options.decimals`.
- `SqlLine.tsx` — `recharts` `LineChart`. `xCol` is the x-axis; `yCol` is the
  y-axis. If `yCol` is an array, render multiple lines.
- `SqlBar.tsx` — `recharts` `BarChart`. Same `xCol` / `yCol` contract.
- `SqlTable.tsx` — minimal table, max-height scroll, sticky header, optional
  `options.columns` filter.

### Inferred viz (server-side, preview only)

Used to pre-fill the viz select when the author runs preview:

- 1 row × 1 numeric column → `number`
- Column named `t` (text or date) + numeric column(s) → `line`
- Text column + numeric column → `bar`
- Anything else → `table`

The author may override the inference.

### Palette integration

`web/src/widgets/registry.ts` continues to hold the static code-defined
widgets. A new helper `loadDynamicWidgets()` fetches `/api/sql-widgets`, maps
each row to a palette entry:

```ts
{
  label: row.name,
  description: row.description ?? '',
  defaultSize: { w: 3, h: 2 },  // line/bar/table get { w: 6, h: 4 }
  scope: deriveScope(row.data_source),  // "overview" | "app"
  appSlug: deriveAppSlug(row.data_source),  // when scope === "app"
  Component: (props) => <SqlWidget widgetId={row.id} {...props} />,
}
```

`deriveScope` / `deriveAppSlug` consult `/api/sql-widgets/sources`. Palette
consumers (Overview, AppPage) merge the dynamic entries with `WIDGETS` and
filter by current context.

### Layout entries

A cell with `kind === "sql"` carries `widget_id`. The grid `id` is
`"sql:<widget_id>"`. Cells whose data source no longer matches the current page
context are filtered out at render time and removed from the layout on the next
save.

### Loading / error / deleted states

- **Loading** — existing widget skeleton, reused.
- **Error** — inline message inside the card frame, same component pattern as
  `KpiCard` failures.
- **Deleted** — "Widget deleted" tile with a button that removes the entry
  from the user's layout.

## Section 5 — Admin Authoring UI

New page `web/src/pages/SqlWidgets.tsx`, mounted at `/settings/sql-widgets`.
Linked from the Settings nav for admins only; non-admins hit the router's 404.

### Layout

- **Top of page:** a table of saved widgets — name, data source, viz,
  `updated_at`, with edit and delete actions per row.
- **"New widget" button** opens the editor (a full-height right-drawer or
  modal).

### Editor fields

- **Name** (required text input)
- **Description** (optional text input)
- **Data source** select (populated from `/api/sql-widgets/sources`)
- **SQL** textarea, monospace, ~12 rows. A small hint above reads:
  `Use :range_days to bind the 7d/30d/90d range picker.`
- **Preview** button — disabled until name, data source, and SQL are non-empty.
  Calls `POST /api/sql-widgets/preview`. Shows a spinner while running.
- **Preview result** area appears below the button:
  - Columns
  - First 20 rows
  - `truncated` flag
  - `durationMs`
  - Inferred viz badge
  - On error: red box with the `error` string.
- **Viz** select — defaults to the inferred viz, may be overridden.
- **Viz options** — small dynamic form per viz:
  - `number`: `unit` (text), `decimals` (number)
  - `line` / `bar`: `xCol` (single select from preview columns), `yCol`
    (multi-select)
  - `table`: column multi-select (default all)
- **Save** button — disabled until the last preview succeeded *and* the SQL has
  not changed since (`previewedSqlHash === currentSqlHash`). On click, server
  re-runs the preview once as a second safety check; rejects on error.
- **Cancel** — exits without save.

### No syntax highlighter v1

Plain monospace textarea. CodeMirror can be added later without breaking
anything.

## Section 6 — Testing & Rollout

### Server tests (vitest)

`server/dataSources.test.js`

- Loads JSON + env, returns merged registry without leaking passwords.
- `getReadOnlyPool` caches and reuses; unknown name throws
  `unknown_data_source`.

`server/routes/sqlWidgets.test.js`

- Auth gates: read endpoints require session, write endpoints require admin.
- CRUD round-trip: create → list → patch → delete.
- Preview success: returns `{ columns, rows, inferred_viz, durationMs }`.
- Preview rejects: multi-statement, oversized SQL (>16 KB), unknown data
  source, unknown `:<name>` token besides `:range_days`.
- Preview safety (gated by `SQL_WIDGET_INTEG=1`, requires a real read-only
  role): `INSERT / UPDATE / DELETE / DROP / CREATE / TRUNCATE / COPY` all
  fail with PG-level read-only-transaction errors.
- Row cap: a 1500-row result returns 1000 rows and `truncated = true`.
- `statement_timeout`: `SELECT pg_sleep(10)` errors within ~5 s.
- Cache: a second `run` within TTL hits cache (SQL ran once).

### Front-end tests (vitest + RTL)

- `SqlNumber`, `SqlLine`, `SqlBar`, `SqlTable` — render with fixtures and
  assert the contract per options.
- `SqlWidget` — loading, error, deleted, success states.
- `pages/SqlWidgets.test.tsx` — admin-only route, save gated on preview,
  preview marked stale when SQL is edited, error rendering.

### Rollout phases (one PR per phase)

1. **Data source registry + RO pools.** No user surface. Unit-tested.
2. **Migration + CRUD + preview endpoint.** API-only. Smoke-test via `curl`.
3. **Render path.** `SqlWidget` + four viz components. Manually insert a test
   row to drive an end-to-end smoke check.
4. **Admin authoring page.** Wires phases 2 and 3.
5. **Palette merge** so saved widgets appear in the picker on Overview / AppPage.
6. **Docs.** `docs/data-sources.md` covering the GRANT recipe and the steps to
   add a new source.

### Non-goals (v1)

- No SQL syntax highlighting or autocomplete.
- No per-user widgets — admin-only authoring.
- No parameters beyond `:range_days`.
- No widget sharing/export between dashboards.
- No audit DB table — `console.info` only.
- No widget-level RBAC beyond palette scope.
- No multi-DB-engine support — Postgres only.
