# Custom SQL Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins author dashboard widgets backed by read-only SQL against any configured Postgres data source. Saved widgets appear in the regular palette and render on Overview or AppPage according to their data source's scope.

**Architecture:** A named-pool registry (`server/dataSources.js`) exposes read-only Postgres pools per data source. A new `sql_widgets` table holds widget metadata. A new Express router (`/api/sql-widgets`) handles CRUD, preview, and run; execution wraps every query in `BEGIN READ ONLY` with `statement_timeout = 5000`. A single React widget kind `sql` dispatches to one of four viz components based on the widget's stored `viz` field. Admin authoring lives at `/settings/sql-widgets`.

**Tech Stack:** Node.js, Express, `pg` (Postgres client), Vitest + Supertest (server tests), React + TanStack Query, React Testing Library + Vitest (web tests), recharts.

**Reference spec:** `docs/superpowers/specs/2026-05-21-custom-sql-widget-design.md`

---

## File Structure

### Server (new)
- `server/dataSources.js` — registry loader, read-only pool cache.
- `server/dataSources.test.js` — registry + pool tests.
- `server/sqlWidgets.js` — `executeSqlWidget` helper (param parsing, txn wrapping, row cap).
- `server/sqlWidgets.test.js` — execution-layer tests.
- `server/routes/sqlWidgets.js` — Express router (`/api/sql-widgets`).
- `server/routes/sqlWidgets.test.js` — HTTP-layer tests.

### Server (modified)
- `server/widgets/registry.js` — add `sql` kind so `validateLayout` accepts SQL cells.
- `server/app.js` — mount new router.

### Config (new)
- `config/data_sources.json` — registry entries (dashboard + apps with `db_ro` creds).
- `docs/data-sources.md` — GRANT recipe + admin instructions.

### Migrations (new)
- `migrations/002_sql_widgets.sql` — `sql_widgets` table.

### Web (new)
- `web/src/widgets/SqlWidget.tsx` — dispatcher.
- `web/src/widgets/SqlNumber.tsx` — single-value viz.
- `web/src/widgets/SqlLine.tsx` — line chart viz.
- `web/src/widgets/SqlBar.tsx` — bar chart viz.
- `web/src/widgets/SqlTable.tsx` — table viz.
- `web/src/widgets/SqlWidget.test.tsx`
- `web/src/widgets/SqlNumber.test.tsx`
- `web/src/widgets/SqlLine.test.tsx`
- `web/src/widgets/SqlBar.test.tsx`
- `web/src/widgets/SqlTable.test.tsx`
- `web/src/api/sqlWidgets.ts` — TanStack Query hooks for SQL widgets API.
- `web/src/pages/SqlWidgets.tsx` — admin authoring page.
- `web/src/pages/SqlWidgets.test.tsx`

### Web (modified)
- `web/src/widgets/registry.ts` — add `sql` kind entry.
- `web/src/grid/WidgetPalette.tsx` — render dynamic SQL widget entries.
- `web/src/pages/AppPage.tsx` — pass dynamic widgets into palette + render `kind: "sql"` cells.
- `web/src/pages/Overview.tsx` — same as AppPage.
- `web/src/App.tsx` — add `/settings/sql-widgets` route.
- `web/src/pages/Settings.tsx` — add nav link to SQL widgets editor (admin only).

---

## Phase 1 — Data Source Registry + Read-Only Pools

### Task 1: Data source loader

**Files:**
- Create: `server/dataSources.js`
- Create: `server/dataSources.test.js`
- Create: `config/data_sources.json`

- [ ] **Step 1: Write failing tests**

```js
// server/dataSources.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadDataSources, _resetForTests } from './dataSources.js';

let tmpFile;
beforeEach(() => {
  tmpFile = path.join(os.tmpdir(), `ds-${Date.now()}.json`);
  _resetForTests();
});
afterEach(() => {
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  delete process.env.DATA_SOURCE_RO_PASSWORDS_JSON;
});

describe('loadDataSources', () => {
  it('returns dashboard entry from env when JSON file missing', () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'dashboard';
    process.env.DB_USER = 'dashboard';
    const sources = loadDataSources('/nonexistent.json');
    expect(sources.dashboard).toBeDefined();
    expect(sources.dashboard.scope).toBe('overview');
    expect(sources.dashboard.kind).toBe('dashboard');
  });

  it('merges entries from JSON file with passwords from env', () => {
    fs.writeFileSync(tmpFile, JSON.stringify({
      sportly: {
        kind: 'app', scope: 'app', app_slug: 'sportly',
        db_ro: { host: 'localhost', port: 5432, database: 'sportly', user: 'sportly_ro' }
      }
    }));
    process.env.DATA_SOURCE_RO_PASSWORDS_JSON = JSON.stringify({ sportly: 'pw1' });
    const sources = loadDataSources(tmpFile);
    expect(sources.sportly.db_ro.password).toBe('pw1');
    expect(sources.sportly.app_slug).toBe('sportly');
  });

  it('still emits dashboard entry when JSON file has only app entries', () => {
    fs.writeFileSync(tmpFile, JSON.stringify({
      sportly: { kind: 'app', scope: 'app', app_slug: 'sportly',
        db_ro: { host: 'h', port: 1, database: 'd', user: 'u' } }
    }));
    const sources = loadDataSources(tmpFile);
    expect(sources.dashboard).toBeDefined();
    expect(sources.sportly).toBeDefined();
  });

  it('lets JSON dashboard entry override env-derived one', () => {
    fs.writeFileSync(tmpFile, JSON.stringify({
      dashboard: { kind: 'dashboard', scope: 'overview',
        db_ro: { host: 'override', port: 9999, database: 'd', user: 'u' } }
    }));
    const sources = loadDataSources(tmpFile);
    expect(sources.dashboard.db_ro.host).toBe('override');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd server && npx vitest run dataSources.test.js
```

Expected: FAIL with `Cannot find module './dataSources.js'`.

- [ ] **Step 3: Implement loader**

```js
// server/dataSources.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.resolve(__dirname, '../config/data_sources.json');

let cached = null;

export function _resetForTests() {
  cached = null;
}

export function loadDataSources(p = defaultPath) {
  const raw = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  const passwords = JSON.parse(process.env.DATA_SOURCE_RO_PASSWORDS_JSON || '{}');

  const out = {};

  if (!raw.dashboard) {
    out.dashboard = {
      kind: 'dashboard',
      scope: 'overview',
      db_ro: {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || 'dashboard',
        user: process.env.DB_USER || 'dashboard',
        password: process.env.DB_PASSWORD || ''
      }
    };
  }

  for (const [name, def] of Object.entries(raw)) {
    out[name] = {
      ...def,
      db_ro: { ...def.db_ro, password: passwords[name] || def.db_ro?.password || '' }
    };
  }

  return out;
}

export function listDataSources(p = defaultPath) {
  return Object.entries(loadDataSources(p)).map(([name, d]) => ({
    name, kind: d.kind, scope: d.scope, app_slug: d.app_slug,
  }));
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd server && npx vitest run dataSources.test.js
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/dataSources.js server/dataSources.test.js
git commit -m "feat(sql-widget): data source registry loader"
```

---

### Task 2: Read-only pool cache

**Files:**
- Modify: `server/dataSources.js`
- Modify: `server/dataSources.test.js`

- [ ] **Step 1: Add failing tests for pool cache**

Append to `server/dataSources.test.js`:

```js
import { getReadOnlyPool, closeAllReadOnlyPools } from './dataSources.js';

describe('getReadOnlyPool', () => {
  beforeEach(() => _resetForTests());
  afterEach(async () => { await closeAllReadOnlyPools(); });

  it('throws on unknown data source', () => {
    expect(() => getReadOnlyPool('does_not_exist')).toThrow('unknown_data_source');
  });

  it('caches a pool per data source name', () => {
    fs.writeFileSync(tmpFile, JSON.stringify({
      dashboard: { kind: 'dashboard', scope: 'overview',
        db_ro: { host: 'h', port: 1, database: 'd', user: 'u', password: '' } }
    }));
    const a = getReadOnlyPool('dashboard', tmpFile);
    const b = getReadOnlyPool('dashboard', tmpFile);
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd server && npx vitest run dataSources.test.js
```

Expected: FAIL with `getReadOnlyPool is not exported`.

- [ ] **Step 3: Implement pool cache**

Add to `server/dataSources.js`:

```js
import pg from 'pg';
const { Pool } = pg;

const pools = new Map();

export function getReadOnlyPool(name, p = defaultPath) {
  if (pools.has(name)) return pools.get(name);
  const sources = loadDataSources(p);
  const cfg = sources[name];
  if (!cfg) throw new Error('unknown_data_source');
  const pool = new Pool({
    host: cfg.db_ro.host,
    port: cfg.db_ro.port,
    database: cfg.db_ro.database,
    user: cfg.db_ro.user,
    password: cfg.db_ro.password,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on('error', (err) => console.error('ro pool error', name, err.message));
  pools.set(name, pool);
  return pool;
}

export async function closeAllReadOnlyPools() {
  for (const p of pools.values()) await p.end();
  pools.clear();
}
```

Also update `_resetForTests`:

```js
export function _resetForTests() {
  cached = null;
  pools.clear();
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd server && npx vitest run dataSources.test.js
```

Expected: all tests pass (including the original 4 plus 2 new).

- [ ] **Step 5: Commit**

```bash
git add server/dataSources.js server/dataSources.test.js
git commit -m "feat(sql-widget): read-only pool cache per data source"
```

---

### Task 3: Default data sources config file

**Files:**
- Create: `config/data_sources.json`
- Create: `docs/data-sources.md`

- [ ] **Step 1: Write `config/data_sources.json`**

```json
{
  "sportly": {
    "kind": "app",
    "scope": "app",
    "app_slug": "sportly",
    "db_ro": {
      "host": "localhost",
      "port": 5432,
      "database": "sportly",
      "user": "sportly_ro"
    }
  },
  "honeydoeh": {
    "kind": "app",
    "scope": "app",
    "app_slug": "honeydoeh",
    "db_ro": {
      "host": "localhost",
      "port": 5432,
      "database": "honeydoeh",
      "user": "honeydoeh_ro"
    }
  },
  "debtmanager": {
    "kind": "app",
    "scope": "app",
    "app_slug": "debtmanager",
    "db_ro": {
      "host": "localhost",
      "port": 5432,
      "database": "debtapp",
      "user": "debtmanager_ro"
    }
  }
}
```

- [ ] **Step 2: Write `docs/data-sources.md`**

````markdown
# Data Sources

Custom SQL widgets target Postgres databases declared in
`config/data_sources.json`. Every data source must connect via a dedicated
read-only role; the dashboard refuses to execute SQL widgets through any other
account.

## Adding a data source

1. Create the read-only role in the target database:

   ```sql
   CREATE ROLE <name>_ro NOINHERIT LOGIN PASSWORD '<strong password>';
   GRANT CONNECT ON DATABASE <db> TO <name>_ro;
   GRANT USAGE ON SCHEMA public TO <name>_ro;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO <name>_ro;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT SELECT ON TABLES TO <name>_ro;
   ```

2. Add an entry to `config/data_sources.json`:

   ```json
   {
     "<name>": {
       "kind": "app",
       "scope": "app",
       "app_slug": "<slug if app-bound>",
       "db_ro": {
         "host": "localhost",
         "port": 5432,
         "database": "<db>",
         "user": "<name>_ro"
       }
     }
   }
   ```

3. Add the password to the `DATA_SOURCE_RO_PASSWORDS_JSON` env variable. The
   variable holds a JSON object keyed by data source name:

   ```json
   {"<name>":"<strong password>", "sportly":"...", "honeydoeh":"..."}
   ```

4. Restart the dashboard. New SQL widgets can now target the source.

## Dashboard data source

If `dashboard` is omitted from `data_sources.json`, the loader auto-creates an
entry using `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. To
override, declare `dashboard` explicitly in the JSON.
````

- [ ] **Step 3: Commit**

```bash
git add config/data_sources.json docs/data-sources.md
git commit -m "docs(sql-widget): default data sources config and DBA recipe"
```

---

## Phase 2 — Migration, Execution Helper, API

### Task 4: Migration for `sql_widgets` table

**Files:**
- Create: `migrations/002_sql_widgets.sql`

- [ ] **Step 1: Write migration**

```sql
-- migrations/002_sql_widgets.sql
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

- [ ] **Step 2: Apply migration locally**

```bash
node scripts/migrate.js
```

Expected: `Applied 002_sql_widgets.sql`.

- [ ] **Step 3: Verify table exists**

```bash
psql -d dashboard -c "\d sql_widgets"
```

Expected: column listing shows all 9 columns.

- [ ] **Step 4: Commit**

```bash
git add migrations/002_sql_widgets.sql
git commit -m "feat(sql-widget): sql_widgets table migration"
```

---

### Task 5: SQL execution helper — parameter parsing

**Files:**
- Create: `server/sqlWidgets.js`
- Create: `server/sqlWidgets.test.js`

- [ ] **Step 1: Write failing tests for param substitution and SQL validation**

```js
// server/sqlWidgets.test.js
import { describe, it, expect } from 'vitest';
import { rewriteSql, RANGE_DAYS } from './sqlWidgets.js';

describe('rewriteSql', () => {
  it('substitutes :range_days with $1', () => {
    const { text, days } = rewriteSql('SELECT * WHERE n > :range_days', '7d');
    expect(text).toBe('SELECT * WHERE n > $1');
    expect(days).toBe(7);
  });

  it('substitutes every occurrence', () => {
    const { text } = rewriteSql('SELECT :range_days, :range_days', '30d');
    expect(text).toBe('SELECT $1, $1');
  });

  it('defaults unknown range to 30', () => {
    const { days } = rewriteSql('SELECT 1', 'bogus');
    expect(days).toBe(30);
  });

  it('throws on multi-statement SQL', () => {
    expect(() => rewriteSql('SELECT 1; SELECT 2', '7d'))
      .toThrow('bad_sql');
  });

  it('allows trailing semicolon', () => {
    const { text } = rewriteSql('SELECT 1;', '7d');
    expect(text).toBe('SELECT 1;');
  });

  it('throws on oversized SQL', () => {
    expect(() => rewriteSql('SELECT 1 -- ' + 'x'.repeat(20_000), '7d'))
      .toThrow('sql_too_large');
  });

  it('throws on unknown :param tokens', () => {
    expect(() => rewriteSql('SELECT :foo', '7d'))
      .toThrow('unknown_param:foo');
  });

  it('RANGE_DAYS maps known values', () => {
    expect(RANGE_DAYS).toEqual({ '7d': 7, '30d': 30, '90d': 90 });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd server && npx vitest run sqlWidgets.test.js
```

Expected: FAIL with `Cannot find module './sqlWidgets.js'`.

- [ ] **Step 3: Implement `rewriteSql`**

```js
// server/sqlWidgets.js
export const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };
export const MAX_SQL_BYTES = 16 * 1024;
export const STATEMENT_TIMEOUT_MS = 5_000;
export const MAX_ROWS = 1000;

export function rewriteSql(sql, range) {
  if (Buffer.byteLength(sql, 'utf8') > MAX_SQL_BYTES) {
    throw new Error('sql_too_large');
  }
  // Reject multi-statement: a ';' followed by any non-whitespace.
  if (/;\s*\S/.test(sql)) {
    throw new Error('bad_sql');
  }
  const days = RANGE_DAYS[range] ?? 30;

  // Reject unknown :word tokens (other than :range_days).
  const tokens = [...sql.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)].map(m => m[1]);
  for (const t of tokens) {
    if (t !== 'range_days') throw new Error('unknown_param:' + t);
  }
  const text = sql.replace(/:range_days\b/g, '$1');
  return { text, days };
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd server && npx vitest run sqlWidgets.test.js
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/sqlWidgets.js server/sqlWidgets.test.js
git commit -m "feat(sql-widget): SQL parameter substitution and validation"
```

---

### Task 6: `executeSqlWidget` — runs SQL in a read-only transaction

**Files:**
- Modify: `server/sqlWidgets.js`
- Modify: `server/sqlWidgets.test.js`

- [ ] **Step 1: Add failing tests using a fake pool**

Append to `server/sqlWidgets.test.js`:

```js
import { vi } from 'vitest';
import { executeSqlWidget } from './sqlWidgets.js';

function fakePool({ rows = [], fields = [], throwOn = null } = {}) {
  const queries = [];
  const client = {
    query: vi.fn(async (text) => {
      queries.push(text);
      if (throwOn && text === throwOn) throw new Error('boom');
      if (text === 'SET statement_timeout = 5000') return { rows: [] };
      if (text === 'SET default_transaction_read_only = on') return { rows: [] };
      if (text === 'BEGIN READ ONLY') return { rows: [] };
      if (text === 'ROLLBACK') return { rows: [] };
      return { rows, fields };
    }),
    release: vi.fn(),
  };
  return { connect: vi.fn(async () => client), _client: client, _queries: queries };
}

describe('executeSqlWidget', () => {
  it('sets timeout, opens read-only txn, runs sql, rolls back', async () => {
    const pool = fakePool({
      rows: [{ value: 7 }],
      fields: [{ name: 'value' }],
    });
    const out = await executeSqlWidget(pool, 'SELECT :range_days', '7d');
    expect(pool._queries).toEqual([
      'SET statement_timeout = 5000',
      'SET default_transaction_read_only = on',
      'BEGIN READ ONLY',
      'SELECT $1',
      'ROLLBACK',
    ]);
    expect(out.columns).toEqual(['value']);
    expect(out.rows).toEqual([{ value: 7 }]);
    expect(out.truncated).toBe(false);
    expect(pool._client.release).toHaveBeenCalled();
  });

  it('caps rows at MAX_ROWS and sets truncated', async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({ n: i }));
    const pool = fakePool({ rows, fields: [{ name: 'n' }] });
    const out = await executeSqlWidget(pool, 'SELECT n FROM t', '7d');
    expect(out.rows).toHaveLength(1000);
    expect(out.truncated).toBe(true);
  });

  it('rolls back and releases on query error', async () => {
    const pool = fakePool({ throwOn: 'SELECT $1', rows: [], fields: [] });
    await expect(executeSqlWidget(pool, 'SELECT :range_days', '7d'))
      .rejects.toThrow();
    expect(pool._queries).toContain('ROLLBACK');
    expect(pool._client.release).toHaveBeenCalled();
  });

  it('returns durationMs as a number', async () => {
    const pool = fakePool({ rows: [], fields: [] });
    const out = await executeSqlWidget(pool, 'SELECT 1', '7d');
    expect(typeof out.durationMs).toBe('number');
    expect(out.durationMs).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd server && npx vitest run sqlWidgets.test.js
```

Expected: FAIL with `executeSqlWidget is not exported`.

- [ ] **Step 3: Implement `executeSqlWidget`**

Add to `server/sqlWidgets.js`:

```js
export async function executeSqlWidget(pool, sql, range) {
  const { text, days } = rewriteSql(sql, range);
  const start = Date.now();
  const client = await pool.connect();
  try {
    await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    await client.query('SET default_transaction_read_only = on');
    await client.query('BEGIN READ ONLY');
    let result;
    try {
      result = await client.query(text, [days]);
      await client.query('ROLLBACK');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
    const truncated = result.rows.length > MAX_ROWS;
    const rows = truncated ? result.rows.slice(0, MAX_ROWS) : result.rows;
    return {
      columns: result.fields.map(f => f.name),
      rows,
      truncated,
      durationMs: Date.now() - start,
    };
  } finally {
    client.release();
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd server && npx vitest run sqlWidgets.test.js
```

Expected: all 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/sqlWidgets.js server/sqlWidgets.test.js
git commit -m "feat(sql-widget): executeSqlWidget with read-only txn wrapper"
```

---

### Task 7: Inferred viz helper

**Files:**
- Modify: `server/sqlWidgets.js`
- Modify: `server/sqlWidgets.test.js`

- [ ] **Step 1: Write failing tests**

Append:

```js
import { inferViz } from './sqlWidgets.js';

describe('inferViz', () => {
  it('returns number for 1 row × 1 numeric column', () => {
    expect(inferViz({ columns: ['v'], rows: [{ v: 42 }] })).toBe('number');
  });
  it('returns line for t + numeric columns', () => {
    expect(inferViz({
      columns: ['t', 'value'],
      rows: [{ t: '2026-05-01', value: 1 }, { t: '2026-05-02', value: 2 }]
    })).toBe('line');
  });
  it('returns bar for text + numeric', () => {
    expect(inferViz({
      columns: ['label', 'count'],
      rows: [{ label: 'a', count: 1 }, { label: 'b', count: 2 }]
    })).toBe('bar');
  });
  it('returns table otherwise', () => {
    expect(inferViz({
      columns: ['a', 'b', 'c'],
      rows: [{ a: 1, b: 2, c: 3 }, { a: 4, b: 5, c: 6 }]
    })).toBe('table');
  });
  it('returns table for empty result', () => {
    expect(inferViz({ columns: [], rows: [] })).toBe('table');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd server && npx vitest run sqlWidgets.test.js
```

Expected: FAIL with `inferViz is not exported`.

- [ ] **Step 3: Implement**

Add to `server/sqlWidgets.js`:

```js
export function inferViz({ columns, rows }) {
  if (columns.length === 0 || rows.length === 0) return 'table';
  const sample = rows[0];

  if (rows.length === 1 && columns.length === 1) {
    const v = sample[columns[0]];
    if (typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)))) {
      return 'number';
    }
  }

  if (columns[0] === 't' && columns.length >= 2) {
    return 'line';
  }

  if (columns.length === 2 && typeof sample[columns[1]] === 'number') {
    return 'bar';
  }

  return 'table';
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd server && npx vitest run sqlWidgets.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/sqlWidgets.js server/sqlWidgets.test.js
git commit -m "feat(sql-widget): inferViz from result shape"
```

---

### Task 8: Add `sql` kind to server widget registry

**Files:**
- Modify: `server/widgets/registry.js`

Why: `validateLayout` in `server/routes/layouts.js` checks `KIND_INDEX[w.kind]`. Without an `sql` entry, users cannot save layouts containing SQL widgets.

- [ ] **Step 1: Add entry**

Append to the `WIDGETS` array in `server/widgets/registry.js`:

```js
  {
    kind: "sql",
    label: "Custom SQL",
    defaultSize: { w: 3, h: 2 },
    scope: "both",
    paramsSchema: [
      { name: "widget_id", type: "number", required: true },
      { name: "range", type: "enum", values: ["7d", "30d", "90d"], default: "30d" },
    ],
  },
```

- [ ] **Step 2: Verify existing layout tests still pass**

```bash
cd server && npx vitest run routes/layouts.test.js
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/widgets/registry.js
git commit -m "feat(sql-widget): register sql kind in server widget registry"
```

---

### Task 9: SQL widgets router — list, read, sources

**Files:**
- Create: `server/routes/sqlWidgets.js`
- Create: `server/routes/sqlWidgets.test.js`
- Modify: `server/app.js`

- [ ] **Step 1: Write failing tests for GET endpoints + admin gate**

```js
// server/routes/sqlWidgets.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { seedAdmin } from '../auth/seed.js';
import { query } from '../db.js';
import * as dataSources from '../dataSources.js';

let app, adminAgent, userAgent;

beforeEach(async () => {
  await query('TRUNCATE sql_widgets');
  await query(`DELETE FROM sessions`);
  await query(`DELETE FROM users WHERE email IN ('admin@example.com','user@example.com')`);
  await seedAdmin('admin@example.com', 'zX9!muPpetDance#Lurking');
  // Seed a non-admin user with the same hashing pipeline by reusing seedAdmin then flipping is_admin.
  await seedAdmin('user@example.com', 'zX9!muPpetDance#Lurking');
  await query(`UPDATE users SET is_admin=false WHERE email='user@example.com'`);
  vi.spyOn(dataSources, 'listDataSources').mockReturnValue([
    { name: 'dashboard', kind: 'dashboard', scope: 'overview' },
    { name: 'sportly', kind: 'app', scope: 'app', app_slug: 'sportly' },
  ]);
  app = buildApp();
  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({
    email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking'
  });
  userAgent = request.agent(app);
  await userAgent.post('/api/auth/login').send({
    email: 'user@example.com', password: 'zX9!muPpetDance#Lurking'
  });
});

describe('GET /api/sql-widgets', () => {
  it('401 without login', async () => {
    const res = await request(app).get('/api/sql-widgets');
    expect(res.status).toBe(401);
  });

  it('returns empty list when no widgets', async () => {
    const res = await adminAgent.get('/api/sql-widgets');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns inserted widgets', async () => {
    await query(`INSERT INTO sql_widgets(name, data_source, sql, viz)
                 VALUES('Test', 'sportly', 'SELECT 1', 'number')`);
    const res = await adminAgent.get('/api/sql-widgets');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Test');
  });
});

describe('GET /api/sql-widgets/sources', () => {
  it('returns the data source list', async () => {
    const res = await adminAgent.get('/api/sql-widgets/sources');
    expect(res.status).toBe(200);
    expect(res.body.map(s => s.name).sort()).toEqual(['dashboard', 'sportly']);
  });
});

describe('GET /api/sql-widgets/:id', () => {
  it('returns one widget', async () => {
    const ins = await query(`INSERT INTO sql_widgets(name, data_source, sql, viz)
                             VALUES('Test', 'sportly', 'SELECT 1', 'number') RETURNING id`);
    const id = ins.rows[0].id;
    const res = await adminAgent.get(`/api/sql-widgets/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(Number(id));
  });

  it('404 for missing', async () => {
    const res = await adminAgent.get('/api/sql-widgets/999999');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd server && npx vitest run routes/sqlWidgets.test.js
```

Expected: FAIL because router does not exist.

- [ ] **Step 3: Implement router**

```js
// server/routes/sqlWidgets.js
import { Router } from "express";
import { requireAuth, requireAdmin } from "../auth/session.js";
import { listDataSources } from "../dataSources.js";
import { query } from "../db.js";

const router = Router();
router.use(requireAuth);

router.get("/sources", (_req, res) => {
  res.json(listDataSources());
});

router.get("/", async (_req, res) => {
  const { rows } = await query(
    `SELECT id, name, description, data_source, sql, viz, options, created_at, updated_at
       FROM sql_widgets ORDER BY id DESC`
  );
  res.json(rows.map(r => ({ ...r, id: Number(r.id) })));
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bad_id" });
  const { rows } = await query(
    `SELECT id, name, description, data_source, sql, viz, options, created_at, updated_at
       FROM sql_widgets WHERE id=$1`, [id]
  );
  if (!rows[0]) return res.status(404).json({ error: "not_found" });
  res.json({ ...rows[0], id: Number(rows[0].id) });
});

export default router;
```

- [ ] **Step 4: Mount in `server/app.js`**

After `import seerRoutes from "./routes/seer.js";`:

```js
import sqlWidgetsRoutes from "./routes/sqlWidgets.js";
```

After `app.use("/api/seer", seerRoutes);`:

```js
  app.use("/api/sql-widgets", sqlWidgetsRoutes);
```

- [ ] **Step 5: Run test, verify it passes**

```bash
cd server && npx vitest run routes/sqlWidgets.test.js
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/routes/sqlWidgets.js server/routes/sqlWidgets.test.js server/app.js
git commit -m "feat(sql-widget): list/read/sources endpoints"
```

---

### Task 10: SQL widgets router — preview endpoint

**Files:**
- Modify: `server/routes/sqlWidgets.js`
- Modify: `server/routes/sqlWidgets.test.js`

- [ ] **Step 1: Write failing tests**

Append to `server/routes/sqlWidgets.test.js`:

```js
import * as sqlWidgets from '../sqlWidgets.js';
import { getReadOnlyPool } from '../dataSources.js';

describe('POST /api/sql-widgets/preview', () => {
  beforeEach(() => {
    vi.spyOn(sqlWidgets, 'executeSqlWidget').mockResolvedValue({
      columns: ['value'], rows: [{ value: 42 }], truncated: false, durationMs: 5,
    });
  });

  it('requires admin', async () => {
    const res = await userAgent.post('/api/sql-widgets/preview')
      .send({ data_source: 'sportly', sql: 'SELECT 1', range: '7d' });
    expect(res.status).toBe(403);
  });

  it('returns columns, rows, inferred viz, durationMs on success', async () => {
    const res = await adminAgent.post('/api/sql-widgets/preview')
      .send({ data_source: 'sportly', sql: 'SELECT 1 AS value', range: '7d' });
    expect(res.status).toBe(200);
    expect(res.body.columns).toEqual(['value']);
    expect(res.body.rows).toEqual([{ value: 42 }]);
    expect(res.body.inferred_viz).toBe('number');
    expect(res.body.durationMs).toBe(5);
  });

  it('returns 400 with safe error string on bad SQL', async () => {
    sqlWidgets.executeSqlWidget.mockRejectedValueOnce(new Error('bad_sql'));
    const res = await adminAgent.post('/api/sql-widgets/preview')
      .send({ data_source: 'sportly', sql: 'SELECT 1; SELECT 2', range: '7d' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('bad_sql');
  });

  it('returns 400 for unknown data source', async () => {
    const res = await adminAgent.post('/api/sql-widgets/preview')
      .send({ data_source: 'nope', sql: 'SELECT 1', range: '7d' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unknown_data_source');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd server && npx vitest run routes/sqlWidgets.test.js
```

Expected: FAIL because `/preview` does not exist.

- [ ] **Step 3: Implement preview route**

Add to `server/routes/sqlWidgets.js` *before* `router.get("/:id", ...)`:

```js
import { executeSqlWidget, inferViz } from "../sqlWidgets.js";
import { getReadOnlyPool, listDataSources } from "../dataSources.js";

router.post("/preview", requireAdmin, async (req, res) => {
  const { data_source, sql, range } = req.body || {};
  if (typeof data_source !== "string" || typeof sql !== "string") {
    return res.status(400).json({ error: "bad_request" });
  }
  const sources = listDataSources();
  if (!sources.some(s => s.name === data_source)) {
    return res.status(400).json({ error: "unknown_data_source" });
  }
  try {
    const pool = getReadOnlyPool(data_source);
    const result = await executeSqlWidget(pool, sql, range || "30d");
    const inferred = inferViz(result);
    console.info(
      `sql_widget event=preview actor=${req.user.email} ds=${data_source} ` +
      `rows=${result.rows.length} duration_ms=${result.durationMs}`
    );
    res.json({ ...result, inferred_viz: inferred });
  } catch (err) {
    console.info(
      `sql_widget event=preview actor=${req.user.email} ds=${data_source} error=${err.message}`
    );
    res.status(400).json({ error: safeErrorMessage(err) });
  }
});

function safeErrorMessage(err) {
  const msg = err.message || "execution_error";
  if (msg.startsWith("unknown_param:")) return msg;
  if (["bad_sql", "sql_too_large", "unknown_data_source"].includes(msg)) return msg;
  if (err.code === "42501" || /read-only/i.test(msg)) return "read_only_violation";
  if (err.code === "57014") return "timeout";
  return msg.replace(/[\r\n]+/g, " ").slice(0, 200);
}
```

Note: existing `listDataSources` import in `/sources` route is now shared with this endpoint.

- [ ] **Step 4: Run test, verify it passes**

```bash
cd server && npx vitest run routes/sqlWidgets.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/routes/sqlWidgets.js server/routes/sqlWidgets.test.js
git commit -m "feat(sql-widget): preview endpoint"
```

---

### Task 11: SQL widgets router — create, update, delete

**Files:**
- Modify: `server/routes/sqlWidgets.js`
- Modify: `server/routes/sqlWidgets.test.js`

- [ ] **Step 1: Write failing tests**

Append:

```js
describe('POST /api/sql-widgets (create)', () => {
  it('requires admin', async () => {
    const res = await userAgent.post('/api/sql-widgets')
      .send({ name: 'X', data_source: 'sportly', sql: 'SELECT 1', viz: 'number' });
    expect(res.status).toBe(403);
  });

  it('rejects missing required fields', async () => {
    const res = await adminAgent.post('/api/sql-widgets').send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown data_source', async () => {
    const res = await adminAgent.post('/api/sql-widgets')
      .send({ name: 'X', data_source: 'nope', sql: 'SELECT 1', viz: 'number' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unknown_data_source');
  });

  it('rejects invalid viz', async () => {
    const res = await adminAgent.post('/api/sql-widgets')
      .send({ name: 'X', data_source: 'sportly', sql: 'SELECT 1', viz: 'pie' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('bad_viz');
  });

  it('creates and returns the widget with numeric id', async () => {
    vi.spyOn(sqlWidgets, 'executeSqlWidget').mockResolvedValue({
      columns: ['v'], rows: [{ v: 1 }], truncated: false, durationMs: 1,
    });
    const res = await adminAgent.post('/api/sql-widgets')
      .send({ name: 'X', data_source: 'sportly', sql: 'SELECT 1', viz: 'number' });
    expect(res.status).toBe(200);
    expect(res.body.id).toEqual(expect.any(Number));
    expect(res.body.name).toBe('X');
  });

  it('rejects create when validation execution fails', async () => {
    vi.spyOn(sqlWidgets, 'executeSqlWidget').mockRejectedValueOnce(new Error('bad_sql'));
    const res = await adminAgent.post('/api/sql-widgets')
      .send({ name: 'X', data_source: 'sportly', sql: 'SELECT 1;SELECT 2', viz: 'number' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('bad_sql');
  });
});

describe('PATCH /api/sql-widgets/:id', () => {
  let id;
  beforeEach(async () => {
    const r = await query(`INSERT INTO sql_widgets(name, data_source, sql, viz)
                           VALUES('X', 'sportly', 'SELECT 1', 'number') RETURNING id`);
    id = r.rows[0].id;
    vi.spyOn(sqlWidgets, 'executeSqlWidget').mockResolvedValue({
      columns: ['v'], rows: [{ v: 1 }], truncated: false, durationMs: 1,
    });
  });
  it('updates name and viz', async () => {
    const res = await adminAgent.patch(`/api/sql-widgets/${id}`)
      .send({ name: 'Renamed', viz: 'table' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
    expect(res.body.viz).toBe('table');
  });
  it('returns 404 for missing id', async () => {
    const res = await adminAgent.patch('/api/sql-widgets/999999').send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/sql-widgets/:id', () => {
  it('removes the row', async () => {
    const r = await query(`INSERT INTO sql_widgets(name, data_source, sql, viz)
                           VALUES('X', 'sportly', 'SELECT 1', 'number') RETURNING id`);
    const id = r.rows[0].id;
    const res = await adminAgent.delete(`/api/sql-widgets/${id}`);
    expect(res.status).toBe(200);
    const after = await query(`SELECT id FROM sql_widgets WHERE id=$1`, [id]);
    expect(after.rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd server && npx vitest run routes/sqlWidgets.test.js
```

Expected: FAIL because mutation routes do not exist.

- [ ] **Step 3: Implement CRUD routes**

Add to `server/routes/sqlWidgets.js`, before `router.get("/:id", ...)`:

```js
const VALID_VIZ = new Set(["number", "line", "bar", "table"]);

function validateBody(body) {
  if (!body || typeof body !== "object") return "bad_request";
  if (typeof body.name !== "string" || !body.name.trim()) return "bad_request";
  if (typeof body.data_source !== "string") return "bad_request";
  if (typeof body.sql !== "string") return "bad_request";
  if (!VALID_VIZ.has(body.viz)) return "bad_viz";
  return null;
}

router.post("/", requireAdmin, async (req, res) => {
  const reason = validateBody(req.body);
  if (reason) return res.status(400).json({ error: reason });
  const { name, description = null, data_source, sql, viz, options = {} } = req.body;

  const sources = listDataSources();
  if (!sources.some(s => s.name === data_source)) {
    return res.status(400).json({ error: "unknown_data_source" });
  }
  try {
    const pool = getReadOnlyPool(data_source);
    await executeSqlWidget(pool, sql, "30d");
  } catch (err) {
    return res.status(400).json({ error: safeErrorMessage(err) });
  }
  const { rows } = await query(
    `INSERT INTO sql_widgets(name, description, data_source, sql, viz, options, created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, name, description, data_source, sql, viz, options, created_at, updated_at`,
    [name, description, data_source, sql, viz, options, req.user.id]
  );
  res.json({ ...rows[0], id: Number(rows[0].id) });
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bad_id" });

  const cur = await query(`SELECT * FROM sql_widgets WHERE id=$1`, [id]);
  if (!cur.rows[0]) return res.status(404).json({ error: "not_found" });

  const merged = { ...cur.rows[0], ...req.body };
  const reason = validateBody(merged);
  if (reason) return res.status(400).json({ error: reason });

  const sources = listDataSources();
  if (!sources.some(s => s.name === merged.data_source)) {
    return res.status(400).json({ error: "unknown_data_source" });
  }
  try {
    const pool = getReadOnlyPool(merged.data_source);
    await executeSqlWidget(pool, merged.sql, "30d");
  } catch (err) {
    return res.status(400).json({ error: safeErrorMessage(err) });
  }
  const { rows } = await query(
    `UPDATE sql_widgets
        SET name=$2, description=$3, data_source=$4, sql=$5, viz=$6, options=$7, updated_at=NOW()
      WHERE id=$1
      RETURNING id, name, description, data_source, sql, viz, options, created_at, updated_at`,
    [id, merged.name, merged.description, merged.data_source, merged.sql, merged.viz, merged.options]
  );
  res.json({ ...rows[0], id: Number(rows[0].id) });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bad_id" });
  await query(`DELETE FROM sql_widgets WHERE id=$1`, [id]);
  res.json({ ok: true });
});
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd server && npx vitest run routes/sqlWidgets.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/routes/sqlWidgets.js server/routes/sqlWidgets.test.js
git commit -m "feat(sql-widget): create/update/delete endpoints"
```

---

### Task 12: SQL widgets router — run endpoint with cache

**Files:**
- Modify: `server/routes/sqlWidgets.js`
- Modify: `server/routes/sqlWidgets.test.js`

- [ ] **Step 1: Write failing tests**

Append:

```js
import { metricsCache } from '../cache.js';

describe('GET /api/sql-widgets/:id/run', () => {
  let id;
  beforeEach(async () => {
    metricsCache.clear();
    const r = await query(`INSERT INTO sql_widgets(name, data_source, sql, viz)
                           VALUES('X', 'sportly', 'SELECT :range_days', 'number')
                           RETURNING id`);
    id = r.rows[0].id;
    vi.spyOn(sqlWidgets, 'executeSqlWidget').mockResolvedValue({
      columns: ['days'], rows: [{ days: 7 }], truncated: false, durationMs: 1,
    });
  });

  it('returns data envelope with rows', async () => {
    const res = await adminAgent.get(`/api/sql-widgets/${id}/run?range=7d`);
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toEqual([{ days: 7 }]);
  });

  it('caches repeat calls within TTL', async () => {
    await adminAgent.get(`/api/sql-widgets/${id}/run?range=7d`);
    await adminAgent.get(`/api/sql-widgets/${id}/run?range=7d`);
    expect(sqlWidgets.executeSqlWidget).toHaveBeenCalledTimes(1);
  });

  it('does not cache across ranges', async () => {
    await adminAgent.get(`/api/sql-widgets/${id}/run?range=7d`);
    await adminAgent.get(`/api/sql-widgets/${id}/run?range=30d`);
    expect(sqlWidgets.executeSqlWidget).toHaveBeenCalledTimes(2);
  });

  it('returns error envelope on execution failure', async () => {
    sqlWidgets.executeSqlWidget.mockRejectedValueOnce(new Error('timeout'));
    const res = await adminAgent.get(`/api/sql-widgets/${id}/run?range=7d`);
    expect(res.status).toBe(200);
    expect(res.body.error).toBe('timeout');
  });

  it('404 for missing widget', async () => {
    const res = await adminAgent.get(`/api/sql-widgets/999999/run?range=7d`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd server && npx vitest run routes/sqlWidgets.test.js
```

Expected: FAIL because `/run` does not exist.

- [ ] **Step 3: Implement `/run`**

Add to `server/routes/sqlWidgets.js`, before `router.get("/:id", ...)`:

```js
import { metricsCache } from "../cache.js";
const RUN_TTL_MS = 30_000;
const RUN_ERR_TTL_MS = 10_000;

router.get("/:id/run", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bad_id" });
  const range = String(req.query.range || "30d");
  const cacheKey = `sql:${id}:${range}`;
  const cached = metricsCache.get(cacheKey);
  if (cached) return res.json(cached);

  const { rows } = await query(
    `SELECT data_source, sql FROM sql_widgets WHERE id=$1`, [id]
  );
  if (!rows[0]) return res.status(404).json({ error: "not_found" });

  try {
    const pool = getReadOnlyPool(rows[0].data_source);
    const result = await executeSqlWidget(pool, rows[0].sql, range);
    const envelope = { data: result };
    metricsCache.set(cacheKey, envelope, RUN_TTL_MS);
    console.info(
      `sql_widget event=run actor=${req.user.email} ds=${rows[0].data_source} id=${id} ` +
      `rows=${result.rows.length} duration_ms=${result.durationMs}`
    );
    res.json(envelope);
  } catch (err) {
    const envelope = { error: safeErrorMessage(err) };
    metricsCache.set(cacheKey, envelope, RUN_ERR_TTL_MS);
    res.json(envelope);
  }
});
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd server && npx vitest run routes/sqlWidgets.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/routes/sqlWidgets.js server/routes/sqlWidgets.test.js
git commit -m "feat(sql-widget): run endpoint with cache"
```

---

## Phase 3 — Front-End Render Path

### Task 13: API hooks for SQL widgets

**Files:**
- Create: `web/src/api/sqlWidgets.ts`

- [ ] **Step 1: Write the hook module**

```ts
// web/src/api/sqlWidgets.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export type SqlVizKind = "number" | "line" | "bar" | "table";

export type SqlWidget = {
  id: number;
  name: string;
  description: string | null;
  data_source: string;
  sql: string;
  viz: SqlVizKind;
  options: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type DataSource = {
  name: string;
  kind: string;
  scope: "overview" | "app";
  app_slug?: string;
};

export type SqlRunResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  durationMs: number;
};

export type PreviewResult = SqlRunResult & { inferred_viz: SqlVizKind };

export function useSqlWidgets() {
  return useQuery({
    queryKey: ["sql-widgets"],
    queryFn: () => api.get<SqlWidget[]>("/api/sql-widgets"),
  });
}

export function useSqlWidget(id: number) {
  return useQuery({
    queryKey: ["sql-widget", id],
    queryFn: () => api.get<SqlWidget>(`/api/sql-widgets/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useSqlDataSources() {
  return useQuery({
    queryKey: ["sql-data-sources"],
    queryFn: () => api.get<DataSource[]>("/api/sql-widgets/sources"),
  });
}

export function useSqlRun(id: number, range: string) {
  return useQuery({
    queryKey: ["sql-run", id, range],
    queryFn: () =>
      api.get<{ data?: SqlRunResult; error?: string }>(
        `/api/sql-widgets/${id}/run?range=${encodeURIComponent(range)}`
      ),
    enabled: Number.isFinite(id),
  });
}

export function useSqlPreview() {
  return useMutation({
    mutationFn: (body: { data_source: string; sql: string; range: string }) =>
      api.post<PreviewResult & { error?: string }>("/api/sql-widgets/preview", body),
  });
}

export function useCreateSqlWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<SqlWidget>) =>
      api.post<SqlWidget>("/api/sql-widgets", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sql-widgets"] }),
  });
}

export function useUpdateSqlWidget(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<SqlWidget>) =>
      api.put<SqlWidget>(`/api/sql-widgets/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sql-widgets"] });
      qc.invalidateQueries({ queryKey: ["sql-widget", id] });
    },
  });
}

export function useDeleteSqlWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<{ ok: boolean }>(`/api/sql-widgets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sql-widgets"] }),
  });
}
```

Note: the existing `api` client exports `put` but not `patch`. The server uses `PATCH` for update. Pick one approach: add `patch` to `web/src/api/client.ts`. See next step.

- [ ] **Step 2: Add `patch` to the API client**

In `web/src/api/client.ts`, replace the exported `api` object with:

```ts
export const api = {
  get: <T>(p: string) => request<T>("GET", p),
  post: <T>(p: string, b?: unknown) => request<T>("POST", p, b),
  put: <T>(p: string, b: unknown) => request<T>("PUT", p, b),
  patch: <T>(p: string, b: unknown) => request<T>("PATCH", p, b),
  del: <T>(p: string) => request<T>("DELETE", p),
};
```

Then change `useUpdateSqlWidget` in `web/src/api/sqlWidgets.ts` to use `api.patch` instead of `api.put`.

- [ ] **Step 3: Commit**

```bash
git add web/src/api/sqlWidgets.ts web/src/api/client.ts
git commit -m "feat(sql-widget): TanStack Query hooks for sql-widgets API"
```

---

### Task 14: SqlNumber viz component

**Files:**
- Create: `web/src/widgets/SqlNumber.tsx`
- Create: `web/src/widgets/SqlNumber.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// web/src/widgets/SqlNumber.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SqlNumber from "./SqlNumber";

describe("SqlNumber", () => {
  it("renders the first column of the first row", () => {
    render(<SqlNumber result={{ columns: ["v"], rows: [{ v: 42 }], truncated: false, durationMs: 1 }} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });
  it("applies unit suffix from options", () => {
    render(<SqlNumber
      result={{ columns: ["v"], rows: [{ v: 5 }], truncated: false, durationMs: 1 }}
      options={{ unit: "%" }}
    />);
    expect(screen.getByText("5%")).toBeInTheDocument();
  });
  it("formats with decimals when provided", () => {
    render(<SqlNumber
      result={{ columns: ["v"], rows: [{ v: 3.14159 }], truncated: false, durationMs: 1 }}
      options={{ decimals: 2 }}
    />);
    expect(screen.getByText("3.14")).toBeInTheDocument();
  });
  it("renders em-dash for empty result", () => {
    render(<SqlNumber result={{ columns: [], rows: [], truncated: false, durationMs: 1 }} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd web && npx vitest run src/widgets/SqlNumber.test.tsx
```

Expected: FAIL with "Cannot find module './SqlNumber'".

- [ ] **Step 3: Implement**

```tsx
// web/src/widgets/SqlNumber.tsx
import type { SqlRunResult } from "../api/sqlWidgets";

export default function SqlNumber({
  result,
  options = {},
}: {
  result: SqlRunResult;
  options?: { unit?: string; decimals?: number };
}) {
  const col = result.columns[0];
  const row = result.rows[0];
  if (!col || !row) {
    return <div className="metric metric--lg">—</div>;
  }
  const raw = row[col];
  const num = typeof raw === "number" ? raw : Number(raw);
  const formatted =
    typeof options.decimals === "number" && Number.isFinite(num)
      ? num.toFixed(options.decimals)
      : String(raw);
  return (
    <div className="metric metric--lg">
      {formatted}
      {options.unit ?? ""}
    </div>
  );
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd web && npx vitest run src/widgets/SqlNumber.test.tsx
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/widgets/SqlNumber.tsx web/src/widgets/SqlNumber.test.tsx
git commit -m "feat(sql-widget): SqlNumber viz"
```

---

### Task 15: SqlLine viz component

**Files:**
- Create: `web/src/widgets/SqlLine.tsx`
- Create: `web/src/widgets/SqlLine.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// web/src/widgets/SqlLine.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import SqlLine from "./SqlLine";

describe("SqlLine", () => {
  it("renders without crashing for a basic line series", () => {
    const { container } = render(<SqlLine
      result={{
        columns: ["t", "value"],
        rows: [{ t: "2026-05-01", value: 1 }, { t: "2026-05-02", value: 2 }],
        truncated: false, durationMs: 1,
      }}
      options={{ xCol: "t", yCol: "value" }}
    />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
  it("renders multi-series when yCol is an array", () => {
    const { container } = render(<SqlLine
      result={{
        columns: ["t", "a", "b"],
        rows: [{ t: "2026-05-01", a: 1, b: 2 }],
        truncated: false, durationMs: 1,
      }}
      options={{ xCol: "t", yCol: ["a", "b"] }}
    />);
    // recharts renders one path per series; we assert at least one chart and two Line components in the DOM
    expect(container.querySelectorAll(".recharts-line").length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd web && npx vitest run src/widgets/SqlLine.test.tsx
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement**

```tsx
// web/src/widgets/SqlLine.tsx
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { SqlRunResult } from "../api/sqlWidgets";

const COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)", "var(--chart-6)",
];

export default function SqlLine({
  result, options,
}: {
  result: SqlRunResult;
  options?: { xCol?: string; yCol?: string | string[] };
}) {
  const xCol = options?.xCol ?? result.columns[0] ?? "x";
  const yCols = Array.isArray(options?.yCol)
    ? options.yCol
    : options?.yCol
      ? [options.yCol]
      : result.columns.filter(c => c !== xCol);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={result.rows}>
        <CartesianGrid stroke="var(--grid-line)" />
        <XAxis dataKey={xCol} tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        {yCols.map((y, i) => (
          <Line
            key={y}
            type="monotone"
            dataKey={y}
            stroke={COLORS[i % COLORS.length]}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd web && npx vitest run src/widgets/SqlLine.test.tsx
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/widgets/SqlLine.tsx web/src/widgets/SqlLine.test.tsx
git commit -m "feat(sql-widget): SqlLine viz"
```

---

### Task 16: SqlBar viz component

**Files:**
- Create: `web/src/widgets/SqlBar.tsx`
- Create: `web/src/widgets/SqlBar.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// web/src/widgets/SqlBar.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import SqlBar from "./SqlBar";

describe("SqlBar", () => {
  it("renders an SVG for a basic bar series", () => {
    const { container } = render(<SqlBar
      result={{
        columns: ["label", "count"],
        rows: [{ label: "a", count: 1 }, { label: "b", count: 3 }],
        truncated: false, durationMs: 1,
      }}
      options={{ xCol: "label", yCol: "count" }}
    />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd web && npx vitest run src/widgets/SqlBar.test.tsx
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement**

```tsx
// web/src/widgets/SqlBar.tsx
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { SqlRunResult } from "../api/sqlWidgets";

const COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)", "var(--chart-6)",
];

export default function SqlBar({
  result, options,
}: {
  result: SqlRunResult;
  options?: { xCol?: string; yCol?: string | string[] };
}) {
  const xCol = options?.xCol ?? result.columns[0] ?? "x";
  const yCols = Array.isArray(options?.yCol)
    ? options.yCol
    : options?.yCol
      ? [options.yCol]
      : result.columns.filter(c => c !== xCol);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={result.rows}>
        <CartesianGrid stroke="var(--grid-line)" />
        <XAxis dataKey={xCol} tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        {yCols.map((y, i) => (
          <Bar key={y} dataKey={y} fill={COLORS[i % COLORS.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd web && npx vitest run src/widgets/SqlBar.test.tsx
```

Expected: test passes.

- [ ] **Step 5: Commit**

```bash
git add web/src/widgets/SqlBar.tsx web/src/widgets/SqlBar.test.tsx
git commit -m "feat(sql-widget): SqlBar viz"
```

---

### Task 17: SqlTable viz component

**Files:**
- Create: `web/src/widgets/SqlTable.tsx`
- Create: `web/src/widgets/SqlTable.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// web/src/widgets/SqlTable.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SqlTable from "./SqlTable";

describe("SqlTable", () => {
  it("renders headers and cells", () => {
    render(<SqlTable result={{
      columns: ["name", "count"],
      rows: [{ name: "Alice", count: 3 }, { name: "Bob", count: 5 }],
      truncated: false, durationMs: 1,
    }} />);
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });
  it("filters columns when options.columns is set", () => {
    render(<SqlTable
      result={{ columns: ["a", "b", "c"], rows: [{ a: 1, b: 2, c: 3 }], truncated: false, durationMs: 1 }}
      options={{ columns: ["a", "c"] }}
    />);
    expect(screen.queryByText("b")).toBeNull();
    expect(screen.getByText("c")).toBeInTheDocument();
  });
  it("renders truncated badge when result.truncated", () => {
    render(<SqlTable result={{ columns: ["a"], rows: [{ a: 1 }], truncated: true, durationMs: 1 }} />);
    expect(screen.getByText(/truncated/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd web && npx vitest run src/widgets/SqlTable.test.tsx
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement**

```tsx
// web/src/widgets/SqlTable.tsx
import type { SqlRunResult } from "../api/sqlWidgets";

export default function SqlTable({
  result, options,
}: {
  result: SqlRunResult;
  options?: { columns?: string[] };
}) {
  const cols = options?.columns?.length
    ? options.columns.filter(c => result.columns.includes(c))
    : result.columns;

  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      {result.truncated && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
          truncated to 1000 rows
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ position: "sticky", top: 0, background: "var(--panel)" }}>
          <tr>
            {cols.map(c => (
              <th key={c} style={{ textAlign: "left", padding: "4px 8px",
                                    borderBottom: "1px solid var(--rule)" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i}>
              {cols.map(c => (
                <td key={c} style={{ padding: "4px 8px",
                                     borderBottom: "1px solid var(--rule-faint, var(--rule))" }}>
                  {String(row[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd web && npx vitest run src/widgets/SqlTable.test.tsx
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/widgets/SqlTable.tsx web/src/widgets/SqlTable.test.tsx
git commit -m "feat(sql-widget): SqlTable viz"
```

---

### Task 18: SqlWidget dispatcher

**Files:**
- Create: `web/src/widgets/SqlWidget.tsx`
- Create: `web/src/widgets/SqlWidget.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// web/src/widgets/SqlWidget.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SqlWidget from "./SqlWidget";
import * as hooks from "../api/sqlWidgets";

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("SqlWidget", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows skeleton while loading", () => {
    vi.spyOn(hooks, "useSqlWidget").mockReturnValue({ isLoading: true } as any);
    vi.spyOn(hooks, "useSqlRun").mockReturnValue({ isLoading: true } as any);
    wrap(<SqlWidget widgetId={1} params={{ range: "7d" }} />);
    expect(screen.getByTestId("widget-skeleton")).toBeInTheDocument();
  });

  it("renders SqlNumber for viz=number", async () => {
    vi.spyOn(hooks, "useSqlWidget").mockReturnValue({
      data: { id: 1, name: "X", description: null, data_source: "sportly",
              sql: "SELECT 1", viz: "number", options: {},
              created_at: "", updated_at: "" },
      isLoading: false,
    } as any);
    vi.spyOn(hooks, "useSqlRun").mockReturnValue({
      data: { data: { columns: ["v"], rows: [{ v: 7 }], truncated: false, durationMs: 1 } },
      isLoading: false,
    } as any);
    wrap(<SqlWidget widgetId={1} params={{ range: "7d" }} />);
    await waitFor(() => expect(screen.getByText("7")).toBeInTheDocument());
  });

  it("shows error from envelope", () => {
    vi.spyOn(hooks, "useSqlWidget").mockReturnValue({
      data: { id: 1, name: "X", description: null, data_source: "sportly",
              sql: "X", viz: "number", options: {}, created_at: "", updated_at: "" },
      isLoading: false,
    } as any);
    vi.spyOn(hooks, "useSqlRun").mockReturnValue({
      data: { error: "timeout" }, isLoading: false,
    } as any);
    wrap(<SqlWidget widgetId={1} params={{ range: "7d" }} />);
    expect(screen.getByTitle("timeout")).toBeInTheDocument();
  });

  it("shows deleted-widget tile when metadata 404s", () => {
    vi.spyOn(hooks, "useSqlWidget").mockReturnValue({
      isLoading: false, error: { status: 404 },
    } as any);
    vi.spyOn(hooks, "useSqlRun").mockReturnValue({ isLoading: false } as any);
    wrap(<SqlWidget widgetId={1} params={{ range: "7d" }} />);
    expect(screen.getByText(/widget deleted/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd web && npx vitest run src/widgets/SqlWidget.test.tsx
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement**

```tsx
// web/src/widgets/SqlWidget.tsx
import WidgetFrame from "../grid/WidgetFrame";
import Skeleton from "../grid/Skeleton";
import { useSqlWidget, useSqlRun } from "../api/sqlWidgets";
import SqlNumber from "./SqlNumber";
import SqlLine from "./SqlLine";
import SqlBar from "./SqlBar";
import SqlTable from "./SqlTable";

type Params = { widget_id?: number; range?: string };

export default function SqlWidget({
  params = {},
  onRemove,
}: {
  app?: string;
  params?: Params;
  onRemove?: () => void;
}) {
  const id = Number(params.widget_id);
  const range = params.range || "30d";
  const meta = useSqlWidget(id);
  const run = useSqlRun(id, range);

  if (meta.isLoading || run.isLoading) {
    return (
      <WidgetFrame title="sql" onRemove={onRemove}>
        <div data-testid="widget-skeleton"><Skeleton variant="block" /></div>
      </WidgetFrame>
    );
  }

  if ((meta.error as any)?.status === 404 || !meta.data) {
    return (
      <WidgetFrame title="sql · deleted" onRemove={onRemove}>
        <div style={{ color: "var(--muted)" }}>Widget deleted</div>
      </WidgetFrame>
    );
  }

  const widget = meta.data;
  const error = run.data?.error;
  const result = run.data?.data;

  return (
    <WidgetFrame title={widget.name} meta={widget.data_source} onRemove={onRemove} error={error}>
      {result ? renderViz(widget.viz, result, widget.options) : null}
    </WidgetFrame>
  );
}

function renderViz(viz: string, result: any, options: any) {
  switch (viz) {
    case "number": return <SqlNumber result={result} options={options} />;
    case "line":   return <SqlLine result={result} options={options} />;
    case "bar":    return <SqlBar result={result} options={options} />;
    case "table":
    default:       return <SqlTable result={result} options={options} />;
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd web && npx vitest run src/widgets/SqlWidget.test.tsx
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/widgets/SqlWidget.tsx web/src/widgets/SqlWidget.test.tsx
git commit -m "feat(sql-widget): SqlWidget dispatcher"
```

---

### Task 19: Register `sql` kind in web registry

**Files:**
- Modify: `web/src/widgets/registry.ts`

- [ ] **Step 1: Add `sql` entry**

In `web/src/widgets/registry.ts`, add the import and a new entry. Insert the import after the existing widget imports:

```ts
import SqlWidget from "./SqlWidget";
```

Inside the `WIDGETS` object (anywhere among the existing entries):

```ts
  sql: {
    label: "Custom SQL",
    description: "Render saved custom SQL queries as number, line, bar, or table.",
    defaultSize: { w: 3, h: 2 },
    scope: "both" as const,
    Component: SqlWidget,
  },
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/widgets/registry.ts
git commit -m "feat(sql-widget): register sql kind in web widget registry"
```

---

## Phase 4 — Admin Authoring Page

### Task 20: SqlWidgets page scaffold + list view

**Files:**
- Create: `web/src/pages/SqlWidgets.tsx`
- Create: `web/src/pages/SqlWidgets.test.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// web/src/pages/SqlWidgets.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import SqlWidgets from "./SqlWidgets";
import * as hooks from "../api/sqlWidgets";

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("SqlWidgets page", () => {
  it("lists existing widgets", () => {
    vi.spyOn(hooks, "useSqlWidgets").mockReturnValue({
      data: [{ id: 1, name: "Top users", description: null, data_source: "sportly",
                sql: "SELECT 1", viz: "table", options: {}, created_at: "", updated_at: "" }],
      isLoading: false,
    } as any);
    vi.spyOn(hooks, "useSqlDataSources").mockReturnValue({ data: [], isLoading: false } as any);
    wrap(<SqlWidgets />);
    expect(screen.getByText("Top users")).toBeInTheDocument();
    expect(screen.getByText("sportly")).toBeInTheDocument();
  });
  it("shows empty state when no widgets", () => {
    vi.spyOn(hooks, "useSqlWidgets").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(hooks, "useSqlDataSources").mockReturnValue({ data: [], isLoading: false } as any);
    wrap(<SqlWidgets />);
    expect(screen.getByText(/no sql widgets yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd web && npx vitest run src/pages/SqlWidgets.test.tsx
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement page scaffold**

```tsx
// web/src/pages/SqlWidgets.tsx
import { useState } from "react";
import { useSqlWidgets } from "../api/sqlWidgets";
import type { SqlWidget } from "../api/sqlWidgets";

export default function SqlWidgets() {
  const list = useSqlWidgets();
  const [editing, setEditing] = useState<SqlWidget | "new" | null>(null);
  const widgets = list.data ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <span className="eyebrow">admin · sql widgets</span>
          <h1 style={{ marginTop: 6 }}>Custom SQL widgets</h1>
        </div>
        <button type="button" onClick={() => setEditing("new")}>+ New widget</button>
      </header>

      {widgets.length === 0 ? (
        <div style={{ color: "var(--muted)" }}>No SQL widgets yet.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Data source</th>
              <th style={th}>Viz</th>
              <th style={th}>Updated</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {widgets.map(w => (
              <tr key={w.id}>
                <td style={td}>{w.name}</td>
                <td style={td}>{w.data_source}</td>
                <td style={td}>{w.viz}</td>
                <td style={td}>{new Date(w.updated_at).toLocaleString()}</td>
                <td style={td}><button type="button" onClick={() => setEditing(w)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && <div data-testid="editor-open">{/* editor goes here in next task */}</div>}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left", padding: "6px 8px",
  borderBottom: "1px solid var(--rule)", fontWeight: 500,
};
const td: React.CSSProperties = {
  padding: "6px 8px", borderBottom: "1px solid var(--rule-faint, var(--rule))",
};
```

- [ ] **Step 4: Add route in `web/src/App.tsx`**

Inside `<Route path="/*" element={<Protected><Shell /></Protected>}>` block, alongside the existing routes:

```tsx
<Route path="settings/sql-widgets" element={<SqlWidgets />} />
```

Also import: `import SqlWidgets from "./pages/SqlWidgets";`

- [ ] **Step 5: Run test, verify it passes**

```bash
cd web && npx vitest run src/pages/SqlWidgets.test.tsx
```

Expected: tests pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/SqlWidgets.tsx web/src/pages/SqlWidgets.test.tsx web/src/App.tsx
git commit -m "feat(sql-widget): admin authoring page scaffold + list view"
```

---

### Task 21: SqlWidgets editor — fields, preview, save

**Files:**
- Modify: `web/src/pages/SqlWidgets.tsx`
- Modify: `web/src/pages/SqlWidgets.test.tsx`

- [ ] **Step 1: Write failing tests for editor behavior**

Append:

```tsx
import { fireEvent } from "@testing-library/react";

describe("SqlWidgets editor", () => {
  it("disables Save until a successful preview matches the current SQL", async () => {
    const previewMock = vi.fn().mockResolvedValue({
      columns: ["v"], rows: [{ v: 1 }], truncated: false, durationMs: 1,
      inferred_viz: "number",
    });
    vi.spyOn(hooks, "useSqlWidgets").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(hooks, "useSqlDataSources").mockReturnValue({
      data: [{ name: "sportly", kind: "app", scope: "app", app_slug: "sportly" }], isLoading: false,
    } as any);
    vi.spyOn(hooks, "useSqlPreview").mockReturnValue({
      mutateAsync: previewMock, isPending: false, data: undefined, reset: vi.fn(),
    } as any);
    vi.spyOn(hooks, "useCreateSqlWidget").mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);

    wrap(<SqlWidgets />);
    fireEvent.click(screen.getByText("+ New widget"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Data source"), { target: { value: "sportly" } });
    fireEvent.change(screen.getByLabelText("SQL"), { target: { value: "SELECT 1" } });

    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => expect(previewMock).toHaveBeenCalled());

    await waitFor(() => expect(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled
    ).toBe(false));

    // Editing SQL after preview re-disables save
    fireEvent.change(screen.getByLabelText("SQL"), { target: { value: "SELECT 2" } });
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders preview error message", async () => {
    vi.spyOn(hooks, "useSqlWidgets").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(hooks, "useSqlDataSources").mockReturnValue({
      data: [{ name: "sportly", kind: "app", scope: "app", app_slug: "sportly" }], isLoading: false,
    } as any);
    const previewMock = vi.fn().mockRejectedValue(new Error("bad_sql"));
    vi.spyOn(hooks, "useSqlPreview").mockReturnValue({
      mutateAsync: previewMock, isPending: false, reset: vi.fn(),
    } as any);
    vi.spyOn(hooks, "useCreateSqlWidget").mockReturnValue({ mutateAsync: vi.fn() } as any);

    wrap(<SqlWidgets />);
    fireEvent.click(screen.getByText("+ New widget"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Data source"), { target: { value: "sportly" } });
    fireEvent.change(screen.getByLabelText("SQL"), { target: { value: "SELECT 1; SELECT 2" } });
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => expect(screen.getByText(/bad_sql/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd web && npx vitest run src/pages/SqlWidgets.test.tsx
```

Expected: FAIL (editor fields missing).

- [ ] **Step 3: Implement editor**

Replace the editor placeholder in `web/src/pages/SqlWidgets.tsx`. Add at the bottom of the file:

```tsx
import {
  useSqlDataSources, useSqlPreview, useCreateSqlWidget,
  useUpdateSqlWidget, useDeleteSqlWidget,
} from "../api/sqlWidgets";
import type { PreviewResult, SqlVizKind } from "../api/sqlWidgets";

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return h;
}

function Editor({
  widget, onClose,
}: {
  widget: SqlWidget | "new";
  onClose: () => void;
}) {
  const isNew = widget === "new";
  const initial = isNew
    ? { name: "", description: "", data_source: "", sql: "", viz: "number" as SqlVizKind, options: {} as any }
    : widget;
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [dataSource, setDataSource] = useState(initial.data_source);
  const [sql, setSql] = useState(initial.sql);
  const [viz, setViz] = useState<SqlVizKind>(initial.viz);
  const [options, setOptions] = useState<any>(initial.options ?? {});
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewedHash, setPreviewedHash] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const sources = useSqlDataSources();
  const previewMut = useSqlPreview();
  const createMut = useCreateSqlWidget();
  const updateMut = useUpdateSqlWidget(isNew ? 0 : widget.id);

  async function runPreview() {
    setPreviewError(null);
    try {
      const r = await previewMut.mutateAsync({ data_source: dataSource, sql, range: "30d" });
      if ((r as any).error) {
        setPreviewError((r as any).error);
        setPreview(null);
        setPreviewedHash(null);
      } else {
        setPreview(r);
        setPreviewedHash(hash(sql));
        setViz(r.inferred_viz);
      }
    } catch (e: any) {
      setPreviewError(e.message || "preview failed");
      setPreviewedHash(null);
      setPreview(null);
    }
  }

  const canSave =
    name.trim() &&
    dataSource &&
    sql.trim() &&
    previewedHash === hash(sql);

  async function save() {
    const body = { name, description, data_source: dataSource, sql, viz, options };
    if (isNew) await createMut.mutateAsync(body);
    else await updateMut.mutateAsync(body);
    onClose();
  }

  return (
    <aside style={drawer}>
      <h3>{isNew ? "New SQL widget" : `Edit: ${widget.name}`}</h3>

      <label htmlFor="sw-name">Name</label>
      <input id="sw-name" value={name} onChange={e => setName(e.target.value)} />

      <label htmlFor="sw-desc">Description</label>
      <input id="sw-desc" value={description} onChange={e => setDescription(e.target.value)} />

      <label htmlFor="sw-ds">Data source</label>
      <select id="sw-ds" value={dataSource} onChange={e => setDataSource(e.target.value)}>
        <option value="">—</option>
        {(sources.data ?? []).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
      </select>

      <label htmlFor="sw-sql">SQL</label>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        Use <code>:range_days</code> to bind the 7d/30d/90d range picker.
      </div>
      <textarea
        id="sw-sql"
        rows={12}
        style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
        value={sql}
        onChange={e => setSql(e.target.value)}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={runPreview}
                disabled={!name.trim() || !dataSource || !sql.trim() || previewMut.isPending}>
          {previewMut.isPending ? "Running..." : "Preview"}
        </button>
        <button type="button" onClick={save} disabled={!canSave}>Save</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>

      {previewError && (
        <div role="alert" style={{ color: "var(--bad)" }}>{previewError}</div>
      )}

      {preview && (
        <PreviewArea
          result={preview}
          viz={viz}
          setViz={setViz}
          options={options}
          setOptions={setOptions}
        />
      )}
    </aside>
  );
}

function PreviewArea({
  result, viz, setViz, options, setOptions,
}: {
  result: PreviewResult;
  viz: SqlVizKind;
  setViz: (v: SqlVizKind) => void;
  options: any;
  setOptions: (o: any) => void;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        cols: {result.columns.join(", ")} · rows: {result.rows.length}
        {result.truncated ? " (truncated)" : ""} · {result.durationMs}ms
        · inferred: <strong>{result.inferred_viz}</strong>
      </div>

      <label htmlFor="sw-viz">Viz</label>
      <select id="sw-viz" value={viz} onChange={e => setViz(e.target.value as SqlVizKind)}>
        <option value="number">number</option>
        <option value="line">line</option>
        <option value="bar">bar</option>
        <option value="table">table</option>
      </select>

      {(viz === "line" || viz === "bar") && (
        <>
          <label htmlFor="sw-xcol">x column</label>
          <select id="sw-xcol" value={options.xCol ?? result.columns[0] ?? ""}
                  onChange={e => setOptions({ ...options, xCol: e.target.value })}>
            {result.columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label htmlFor="sw-ycol">y column</label>
          <select id="sw-ycol" value={options.yCol ?? ""}
                  onChange={e => setOptions({ ...options, yCol: e.target.value })}>
            {result.columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </>
      )}

      {viz === "number" && (
        <>
          <label htmlFor="sw-unit">Unit</label>
          <input id="sw-unit" value={options.unit ?? ""}
                 onChange={e => setOptions({ ...options, unit: e.target.value })} />
          <label htmlFor="sw-dec">Decimals</label>
          <input id="sw-dec" type="number" value={options.decimals ?? ""}
                 onChange={e => setOptions({ ...options, decimals: e.target.value ? Number(e.target.value) : undefined })} />
        </>
      )}

      <details>
        <summary>preview rows (first 20)</summary>
        <pre style={{ fontSize: 11 }}>{JSON.stringify(result.rows.slice(0, 20), null, 2)}</pre>
      </details>
    </div>
  );
}

const drawer: React.CSSProperties = {
  position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
  background: "var(--panel)", borderLeft: "1px solid var(--rule)",
  padding: 24, zIndex: 30, overflowY: "auto",
  display: "flex", flexDirection: "column", gap: 8,
};
```

Then in the main `SqlWidgets` component, replace the `editor-open` placeholder with:

```tsx
{editing && <Editor widget={editing} onClose={() => setEditing(null)} />}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cd web && npx vitest run src/pages/SqlWidgets.test.tsx
```

Expected: all editor tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/SqlWidgets.tsx web/src/pages/SqlWidgets.test.tsx
git commit -m "feat(sql-widget): admin authoring editor with required preview"
```

---

### Task 22: Delete + Settings nav link

**Files:**
- Modify: `web/src/pages/SqlWidgets.tsx`
- Modify: `web/src/pages/Settings.tsx`
- Modify: `web/src/pages/SqlWidgets.test.tsx`

- [ ] **Step 1: Write failing test for delete**

Append:

```tsx
describe("SqlWidgets delete", () => {
  it("calls delete mutation when Delete clicked", async () => {
    const delMock = vi.fn().mockResolvedValue({ ok: true });
    vi.spyOn(hooks, "useSqlWidgets").mockReturnValue({
      data: [{ id: 5, name: "Doomed", description: null, data_source: "sportly",
                sql: "SELECT 1", viz: "table", options: {}, created_at: "", updated_at: "" }],
      isLoading: false,
    } as any);
    vi.spyOn(hooks, "useSqlDataSources").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(hooks, "useDeleteSqlWidget").mockReturnValue({ mutateAsync: delMock } as any);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    wrap(<SqlWidgets />);
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(delMock).toHaveBeenCalledWith(5));
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd web && npx vitest run src/pages/SqlWidgets.test.tsx
```

Expected: FAIL because no Delete button exists.

- [ ] **Step 3: Add Delete button to the list row**

Inside the `tbody` row in `SqlWidgets`, add to the actions cell:

```tsx
<td style={td}>
  <button type="button" onClick={() => setEditing(w)}>Edit</button>
  <DeleteButton id={w.id} />
</td>
```

And add at the bottom of the file:

```tsx
function DeleteButton({ id }: { id: number }) {
  const del = useDeleteSqlWidget();
  return (
    <button type="button" onClick={async () => {
      if (!window.confirm("Delete this widget? Layouts referencing it will show a deleted-widget tile."))
        return;
      await del.mutateAsync(id);
    }}>Delete</button>
  );
}
```

- [ ] **Step 4: Add admin-gated link to Settings page**

In `web/src/pages/Settings.tsx`, find an appropriate section (e.g., where admin actions live) and add:

```tsx
{user?.is_admin && (
  <Link to="/settings/sql-widgets">Custom SQL widgets</Link>
)}
```

(Place this where the existing settings sub-links live — match the page's style.)

- [ ] **Step 5: Run test, verify it passes**

```bash
cd web && npx vitest run src/pages/SqlWidgets.test.tsx
```

Expected: delete test passes.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/SqlWidgets.tsx web/src/pages/SqlWidgets.test.tsx web/src/pages/Settings.tsx
git commit -m "feat(sql-widget): delete action + Settings nav link"
```

---

## Phase 5 — Palette Integration

### Task 23: Render dynamic SQL widgets in palette

**Files:**
- Modify: `web/src/grid/WidgetPalette.tsx`
- Modify: `web/src/pages/AppPage.tsx`
- Modify: `web/src/pages/Overview.tsx`

Goal: SQL widgets returned by `/api/sql-widgets` appear as palette entries. Picking one inserts a layout cell with `kind: "sql"`, `params: { widget_id, range }`.

- [ ] **Step 1: Extend WidgetPalette to accept dynamic items**

Replace the WidgetPalette props and items computation in `web/src/grid/WidgetPalette.tsx`:

```tsx
import { X } from "lucide-react";
import { WIDGETS } from "../widgets/registry";

export type DynamicPaletteItem = {
  key: string;
  label: string;
  description: string;
  defaultSize: { w: number; h: number };
  scope: "app" | "overview";
  appSlug?: string;
  onPick: () => void;
};

export default function WidgetPalette({
  open,
  scope,
  appSlug,
  dynamic = [],
  onPick,
  onClose,
}: {
  open: boolean;
  scope: "app" | "overview";
  appSlug?: string;
  dynamic?: DynamicPaletteItem[];
  onPick: (kind: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const staticItems = Object.entries(WIDGETS)
    .filter(([kind, w]) => kind !== "sql" && (w.scope === scope || w.scope === "both"));

  const dynamicItems = dynamic.filter(d =>
    d.scope === scope &&
    (scope === "overview" || d.appSlug === appSlug)
  );

  return (
    /* …existing aside + overlay markup unchanged… */
    /* In the items map, render staticItems with their existing onClick=onPick(kind),
       and dynamicItems with onClick={item.onPick}.                                  */
  );
}
```

Apply the existing list rendering twice — once for `staticItems` (unchanged), then a divider, then `dynamicItems` rendered with `{item.onPick()}` instead of `onPick(kind)`. Keep the visual styling identical.

- [ ] **Step 2: Build dynamic items in `AppPage.tsx`**

At the top of `AppPage`, add:

```tsx
import { useSqlWidgets, useSqlDataSources } from "../api/sqlWidgets";
import type { DynamicPaletteItem } from "../grid/WidgetPalette";

// inside the component
const sqlList = useSqlWidgets();
const sources = useSqlDataSources();

function addSql(widget: { id: number }) {
  const nextY = local.reduce((m, w) => Math.max(m, w.y + w.h), 0);
  const next = [
    ...local,
    {
      id: "w_" + Math.random().toString(36).slice(2, 8),
      kind: "sql",
      app: slug,
      x: 0, y: nextY, w: 3, h: 2,
      params: { widget_id: widget.id, range: "30d" },
    },
  ];
  setLocal(next);
  scheduleSave(next);
}

const dynamicPalette: DynamicPaletteItem[] = (sqlList.data ?? []).map(w => {
  const src = (sources.data ?? []).find(s => s.name === w.data_source);
  return {
    key: `sql:${w.id}`,
    label: w.name,
    description: w.description ?? "",
    defaultSize: { w: 3, h: 2 },
    scope: src?.scope ?? "app",
    appSlug: src?.app_slug,
    onPick: () => addSql(w),
  };
});
```

Pass `dynamic={dynamicPalette} appSlug={slug}` to `<WidgetPalette …>`.

- [ ] **Step 3: Same for `Overview.tsx`**

Apply the same pattern — minus `appSlug`, since Overview filters to `scope === "overview"`. Add an `addSql` helper that places the cell with no `app` field (matching how Overview uses cells).

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev:all
```

In a browser:
1. Log in as admin.
2. Navigate to `/settings/sql-widgets`.
3. Create a widget against `sportly`: `SELECT COUNT(*)::int AS value FROM users`. Pick `number`.
4. Navigate to `/app/sportly`, click `+ Add widget`. Confirm the new widget appears in the palette.
5. Pick it. Confirm it renders the count.
6. Navigate to `/`. Confirm the widget does NOT appear in the overview palette.

Expected: all 6 checks pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/grid/WidgetPalette.tsx web/src/pages/AppPage.tsx web/src/pages/Overview.tsx
git commit -m "feat(sql-widget): merge SQL widgets into palette by scope"
```

---

## Phase 6 — Final Verification

### Task 24: Full server test pass

- [ ] **Step 1: Run the full server suite**

```bash
cd server && npm test
```

Expected: all tests pass (existing + new).

- [ ] **Step 2: Run the full web suite**

```bash
cd web && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Type-check the web app**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual end-to-end (UI) sanity check**

Start the dev environment:

```bash
npm run dev:all
```

Walk through the same 6 steps from Task 23 Step 4, plus:
7. Edit the widget; change its SQL; confirm Save is disabled until preview re-runs.
8. Delete the widget; confirm the placed cell switches to the "deleted widget" tile.
9. Remove the deleted cell from the layout via its `×` button; verify the layout saves cleanly.

Expected: all checks pass.

- [ ] **Step 5: No final commit needed** — verification only.

---

## Out of Scope (v1, per spec)

- SQL syntax highlighting/autocomplete (plain monospace textarea only).
- Per-user widgets (admin-only authoring).
- Parameters beyond `:range_days`.
- Export/sharing of widgets between dashboards.
- Audit DB table (`console.info` only).
- Widget-level RBAC beyond palette scope.
- Multi-DB-engine support (Postgres only).
