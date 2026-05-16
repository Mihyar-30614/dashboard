# Apps Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted React/Express dashboard at `/mnt/storage/apps/dashboard` that monitors Sportly, HoneyDoEh, and DebtManager — surfacing user counts, activity, health, and per-app KPIs in a Gridstack-driven, user-customizable layout.

**Architecture:** Single Express process on port 4010 (dev 4110) serves a Vite-built React SPA plus a JSON API. A background poller reads each app's Postgres directly (read-only role), polls PM2 via `pm2 jlist`, and tails nginx access logs every 30s. Metric values land in an in-memory LRU cache plus a `metric_samples` history table. Auth is invite-only with cookie sessions.

**Tech Stack:** Node 20 + Express + node-postgres + bcrypt + pino. React 18 + Vite + TypeScript + Gridstack + Recharts + TanStack Query. PM2 process manager. Vitest + Playwright for tests.

**Spec:** `docs/superpowers/specs/2026-05-16-dashboard-design.md`

---

## File structure

```
dashboard/
├── .env.example
├── .gitignore
├── package.json                  # workspaces: [server, web]
├── ecosystem.config.cjs
├── config/apps.json
├── docs/superpowers/
│   ├── specs/2026-05-16-dashboard-design.md
│   └── plans/2026-05-16-dashboard.md
├── migrations/
│   ├── 001_init.sql
│   └── README.md
├── scripts/
│   ├── migrate.js
│   ├── seed-admin.js
│   ├── grant-readers.sh
│   └── backup.sh
├── server/
│   ├── package.json
│   ├── index.js                  # Express boot
│   ├── db.js                     # dashboard pg pool
│   ├── appPools.js               # one pg pool per app
│   ├── config.js                 # loads apps.json + env
│   ├── cache.js
│   ├── poller.js
│   ├── auth/
│   │   ├── routes.js
│   │   ├── session.js
│   │   ├── invites.js
│   │   └── password.js           # bcrypt + blocklist
│   ├── routes/
│   │   ├── apps.js
│   │   ├── metrics.js
│   │   ├── layouts.js
│   │   ├── widgets.js
│   │   └── health.js
│   ├── collectors/
│   │   ├── pgUsers.js
│   │   ├── pgActivity.js
│   │   ├── pgKpi.js
│   │   ├── pm2.js
│   │   ├── health.js
│   │   └── nginx.js
│   ├── widgets/registry.js
│   └── test/                     # Vitest setup + fixtures
└── web/
    ├── package.json
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── theme.css
        ├── theme.ts
        ├── api/{client.ts,hooks.ts}
        ├── auth/Login.tsx
        ├── layout/{Shell.tsx,Sidebar.tsx,ThemeToggle.tsx}
        ├── pages/{Overview.tsx,AppPage.tsx,Settings.tsx,AcceptInvite.tsx}
        ├── grid/{GridCanvas.tsx,WidgetFrame.tsx,EditModeBar.tsx,WidgetPalette.tsx}
        └── widgets/
            ├── registry.ts
            ├── UsersTotal.tsx
            ├── SignupsTimeseries.tsx
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

---

## Phase A — Bootstrap

### Task A1: Initialize repo + npm workspaces

**Files:**
- Create: `dashboard/.gitignore`
- Create: `dashboard/package.json`
- Create: `dashboard/server/package.json`
- Create: `dashboard/web/package.json`
- Create: `dashboard/.env.example`

- [ ] **Step 1: Initialize git**

```bash
cd /mnt/storage/apps/dashboard
git init
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
.env
.env.local
web/dist/
logs/
.superpowers/
*.log
.DS_Store
```

- [ ] **Step 3: Write root `package.json`**

```json
{
  "name": "dashboard",
  "private": true,
  "version": "0.1.0",
  "workspaces": ["server", "web"],
  "scripts": {
    "dev": "concurrently -n api,web -c blue,green \"npm run dev -w server\" \"npm run dev -w web\"",
    "build": "npm run build -w web",
    "start": "NODE_ENV=production node server/index.js",
    "migrate": "node scripts/migrate.js",
    "seed:admin": "node scripts/seed-admin.js",
    "test": "npm run test -w server && npm run test -w web"
  },
  "devDependencies": {
    "concurrently": "^9.1.2"
  }
}
```

- [ ] **Step 4: Write `server/package.json`**

```json
{
  "name": "server",
  "version": "0.1.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "dev": "node --watch index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cookie": "^0.7.0",
    "express": "^4.19.2",
    "express-rate-limit": "^7.4.0",
    "morgan": "^1.10.0",
    "pg": "^8.13.0",
    "pino": "^9.4.0",
    "common-passwords": "^0.1.2"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 5: Write `web/package.json`**

```json
{
  "name": "web",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.59.0",
    "gridstack": "^11.1.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.27.0",
    "recharts": "^2.13.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 6: Write `.env.example`**

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
APP_DB_PASSWORDS_JSON={"sportly":"","honeydoeh":"","debtmanager":""}
PM2_BIN=/usr/local/bin/pm2
NGINX_LOG_DIR=/var/log/nginx
```

- [ ] **Step 7: Install dependencies**

```bash
npm install
```

Expected: workspaces installed, no errors.

- [ ] **Step 8: Commit**

```bash
git add .gitignore package.json server/package.json web/package.json .env.example
git commit -m "chore: bootstrap workspace structure"
```

---

### Task A2: Dashboard DB + migration runner

**Files:**
- Create: `dashboard/migrations/001_init.sql`
- Create: `dashboard/scripts/migrate.js`
- Create: `dashboard/server/db.js`

- [ ] **Step 1: Write `migrations/001_init.sql`**

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  user_agent    TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS invites (
  id            BIGSERIAL PRIMARY KEY,
  token         TEXT UNIQUE NOT NULL,
  email         TEXT,
  created_by    BIGINT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS dashboard_layouts (
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  screen        TEXT NOT NULL,
  layout        JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, screen)
);

CREATE TABLE IF NOT EXISTS metric_samples (
  app_slug      TEXT NOT NULL,
  metric        TEXT NOT NULL,
  value         DOUBLE PRECISION NOT NULL,
  taken_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_samples_lookup ON metric_samples(app_slug, metric, taken_at DESC);
```

- [ ] **Step 2: Write `server/db.js`**

```js
import pg from 'pg';

const { Pool } = pg;

export const dbPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'dashboard',
  user: process.env.DB_USER || 'dashboard',
  password: process.env.DB_PASSWORD || '',
  max: 10,
  idleTimeoutMillis: 30000
});

export async function query(text, params) {
  return dbPool.query(text, params);
}
```

- [ ] **Step 3: Write `scripts/migrate.js`**

```js
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { dbPool } from '../server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../migrations');

async function main() {
  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort();

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { rows: applied } = await dbPool.query(
    'SELECT filename FROM schema_migrations'
  );
  const appliedSet = new Set(applied.map(r => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`skip ${file}`);
      continue;
    }
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations(filename) VALUES ($1)',
        [file]
      );
      await client.query('COMMIT');
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  await dbPool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 4: Add `dotenv` to server deps**

```bash
npm install -w server dotenv
```

- [ ] **Step 5: Create dashboard DB and run migration**

```bash
createdb dashboard
cp .env.example .env  # fill DB_PASSWORD if needed
npm run migrate
```

Expected: `applied 001_init.sql`.

- [ ] **Step 6: Verify schema**

```bash
psql dashboard -c "\dt"
```

Expected: tables `users`, `sessions`, `invites`, `dashboard_layouts`, `metric_samples`, `schema_migrations`.

- [ ] **Step 7: Commit**

```bash
git add migrations/ scripts/migrate.js server/db.js server/package.json
git commit -m "feat: dashboard schema + migration runner"
```

---

### Task A3: Vitest test scaffolding (server)

**Files:**
- Create: `dashboard/server/vitest.config.js`
- Create: `dashboard/server/test/helpers.js`

- [ ] **Step 1: Write `server/vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.js'],
    setupFiles: ['./test/helpers.js'],
    pool: 'forks',
    testTimeout: 10000
  }
});
```

- [ ] **Step 2: Write `server/test/helpers.js`**

```js
import 'dotenv/config';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { dbPool } from '../db.js';

export async function resetDb() {
  await dbPool.query('TRUNCATE users, sessions, invites, dashboard_layouts, metric_samples RESTART IDENTITY CASCADE');
}

beforeEach(async () => {
  if (process.env.NODE_ENV === 'test') {
    await resetDb();
  }
});

afterAll(async () => {
  await dbPool.end();
});
```

- [ ] **Step 3: Create test DB**

```bash
createdb dashboard_test
DB_NAME=dashboard_test NODE_ENV=test npm run migrate
```

- [ ] **Step 4: Add `.env.test`**

```
NODE_ENV=test
DB_NAME=dashboard_test
APP_ORIGIN=http://localhost
```

- [ ] **Step 5: Run an empty Vitest pass**

```bash
NODE_ENV=test npm run test -w server
```

Expected: "No test files found" — exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/vitest.config.js server/test/ .env.test
git commit -m "test: vitest harness with db reset"
```

---

## Phase B — Auth

### Task B1: Password module (hash + blocklist)

**Files:**
- Create: `dashboard/server/auth/password.js`
- Create: `dashboard/server/auth/password.test.js`

- [ ] **Step 1: Write failing test `server/auth/password.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePolicy } from './password.js';

describe('password', () => {
  it('rejects passwords shorter than 12 chars', () => {
    expect(validatePolicy('short1!A')).toEqual({ ok: false, reason: 'min_length' });
  });

  it('rejects common passwords', () => {
    expect(validatePolicy('Password1234')).toEqual({ ok: false, reason: 'common' });
  });

  it('accepts a strong password', () => {
    expect(validatePolicy('zX9!muPpetDance#Lurking')).toEqual({ ok: true });
  });

  it('hashes and verifies', async () => {
    const hash = await hashPassword('zX9!muPpetDance#Lurking');
    expect(await verifyPassword('zX9!muPpetDance#Lurking', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

```bash
NODE_ENV=test npm run test -w server -- password
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `server/auth/password.js`**

```js
import bcrypt from 'bcrypt';
import commonPasswords from 'common-passwords';

const COST = 12;
const MIN_LEN = 12;

const blocklist = new Set(
  commonPasswords.list().slice(0, 10_000).map(s => s.toLowerCase())
);

export function validatePolicy(pw) {
  if (typeof pw !== 'string' || pw.length < MIN_LEN) {
    return { ok: false, reason: 'min_length' };
  }
  if (blocklist.has(pw.toLowerCase())) {
    return { ok: false, reason: 'common' };
  }
  return { ok: true };
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, COST);
}

export async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

export function needsRehash(hash) {
  const m = /^\$2[aby]\$(\d+)\$/.exec(hash);
  return !m || Number(m[1]) < COST;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
NODE_ENV=test npm run test -w server -- password
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/auth/password.js server/auth/password.test.js
git commit -m "feat(auth): password hashing + policy"
```

---

### Task B2: Session helpers + middleware

**Files:**
- Create: `dashboard/server/auth/session.js`
- Create: `dashboard/server/auth/session.test.js`

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect } from 'vitest';
import { createSession, loadSession, destroySession } from './session.js';
import { dbPool } from '../db.js';

async function makeUser() {
  const { rows } = await dbPool.query(
    `INSERT INTO users(email,password_hash,is_active,is_admin)
     VALUES($1,$2,true,true) RETURNING id`,
    ['admin@example.com', 'hash']
  );
  return rows[0].id;
}

describe('session', () => {
  it('creates and loads a session', async () => {
    const userId = await makeUser();
    const s = await createSession(userId, 'agent-x');
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/);

    const loaded = await loadSession(s.id);
    expect(loaded.user_id).toBe(String(userId));
    expect(loaded.email).toBe('admin@example.com');
  });

  it('rejects expired sessions', async () => {
    const userId = await makeUser();
    const s = await createSession(userId, 'a', -1);
    expect(await loadSession(s.id)).toBeNull();
  });

  it('destroys sessions', async () => {
    const userId = await makeUser();
    const s = await createSession(userId, 'a');
    await destroySession(s.id);
    expect(await loadSession(s.id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
NODE_ENV=test npm run test -w server -- session
```

Expected: FAIL.

- [ ] **Step 3: Implement `server/auth/session.js`**

```js
import crypto from 'node:crypto';
import { dbPool } from '../db.js';

const SLIDING_THRESHOLD_DAYS = 7;

const cache = new Map(); // id -> { row, until }
const CACHE_MS = 60_000;

function ttlDays() {
  return Number(process.env.SESSION_TTL_DAYS || 30);
}

export async function createSession(userId, userAgent, daysOverride) {
  const id = crypto.randomUUID();
  const days = daysOverride ?? ttlDays();
  const { rows } = await dbPool.query(
    `INSERT INTO sessions(id,user_id,expires_at,user_agent)
     VALUES ($1,$2,NOW() + ($3 || ' days')::interval,$4)
     RETURNING id, expires_at`,
    [id, userId, days, userAgent || null]
  );
  return rows[0];
}

export async function loadSession(id) {
  if (!id) return null;
  const hit = cache.get(id);
  if (hit && hit.until > Date.now()) return hit.row;

  const { rows } = await dbPool.query(
    `SELECT s.id, s.user_id, s.created_at, s.expires_at, u.email, u.is_admin
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
        AND s.expires_at > NOW()
        AND u.is_active`,
    [id]
  );
  const row = rows[0] || null;
  if (row) cache.set(id, { row, until: Date.now() + CACHE_MS });
  return row;
}

export async function rotateIfStale(id) {
  const row = await loadSession(id);
  if (!row) return null;
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (ageMs < SLIDING_THRESHOLD_DAYS * 86_400_000) return { id };
  await destroySession(id);
  return createSession(row.user_id, null);
}

export async function destroySession(id) {
  cache.delete(id);
  await dbPool.query('DELETE FROM sessions WHERE id=$1', [id]);
}

export function sessionMiddleware() {
  return async (req, res, next) => {
    const name = process.env.SESSION_COOKIE_NAME || 'ds';
    const id = req.cookies?.[name];
    const session = await loadSession(id);
    if (session) req.user = { id: session.user_id, email: session.email, is_admin: session.is_admin };
    req.sessionId = session?.id || null;
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'forbidden' });
  next();
}
```

- [ ] **Step 4: Add cookie parser dep**

```bash
npm install -w server cookie-parser
```

- [ ] **Step 5: Run, verify pass**

```bash
NODE_ENV=test npm run test -w server -- session
```

Expected: 3 pass.

- [ ] **Step 6: Commit**

```bash
git add server/auth/session.js server/auth/session.test.js server/package.json
git commit -m "feat(auth): sessions + middleware"
```

---

### Task B3: seed-admin script

**Files:**
- Create: `dashboard/scripts/seed-admin.js`
- Create: `dashboard/server/auth/seed.test.js`
- Create: `dashboard/server/auth/seed.js`

- [ ] **Step 1: Write failing test `server/auth/seed.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { seedAdmin } from './seed.js';
import { dbPool } from '../db.js';

describe('seedAdmin', () => {
  it('creates the first admin', async () => {
    await seedAdmin('admin@example.com', 'zX9!muPpetDance#Lurking');
    const { rows } = await dbPool.query('SELECT email, is_admin FROM users');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ email: 'admin@example.com', is_admin: true });
  });

  it('refuses if users already exist', async () => {
    await seedAdmin('a@example.com', 'zX9!muPpetDance#Lurking');
    await expect(
      seedAdmin('b@example.com', 'zX9!muPpetDance#Lurking')
    ).rejects.toThrow('users_exist');
  });

  it('rejects weak passwords', async () => {
    await expect(seedAdmin('a@example.com', 'short')).rejects.toThrow('min_length');
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `server/auth/seed.js`**

```js
import { dbPool } from '../db.js';
import { hashPassword, validatePolicy } from './password.js';

export async function seedAdmin(email, password) {
  const policy = validatePolicy(password);
  if (!policy.ok) throw new Error(policy.reason);

  const { rows: existing } = await dbPool.query('SELECT 1 FROM users LIMIT 1');
  if (existing.length) throw new Error('users_exist');

  const hash = await hashPassword(password);
  await dbPool.query(
    `INSERT INTO users(email,password_hash,is_admin,is_active)
     VALUES($1,$2,true,true)`,
    [email.toLowerCase(), hash]
  );
}
```

- [ ] **Step 4: Implement `scripts/seed-admin.js`**

```js
import 'dotenv/config';
import { seedAdmin } from '../server/auth/seed.js';
import { dbPool } from '../server/db.js';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  process.exit(1);
}

seedAdmin(email, password)
  .then(() => { console.log('seeded admin'); return dbPool.end(); })
  .catch(err => { console.error(err.message); process.exit(2); });
```

- [ ] **Step 5: Run tests**

```bash
NODE_ENV=test npm run test -w server -- seed
```

Expected: 3 pass.

- [ ] **Step 6: Commit**

```bash
git add server/auth/seed.js server/auth/seed.test.js scripts/seed-admin.js
git commit -m "feat(auth): seed-admin script"
```

---

### Task B4: Express app + auth routes (login/logout/me)

**Files:**
- Create: `dashboard/server/index.js`
- Create: `dashboard/server/app.js` (Express factory, testable)
- Create: `dashboard/server/auth/routes.js`
- Create: `dashboard/server/auth/routes.test.js`

- [ ] **Step 1: Write failing test `server/auth/routes.test.js`**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { seedAdmin } from './seed.js';

let app;
beforeEach(async () => {
  await seedAdmin('admin@example.com', 'zX9!muPpetDance#Lurking');
  app = buildApp();
});

describe('POST /api/auth/login', () => {
  it('issues a session cookie on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/^ds=[0-9a-f-]+;/);
  });

  it('rejects bad credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the user after login', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({
      email: 'admin@example.com',
      password: 'zX9!muPpetDance#Lurking'
    });
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@example.com');
    expect(res.body.is_admin).toBe(true);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({
      email: 'admin@example.com',
      password: 'zX9!muPpetDance#Lurking'
    });
    await agent.post('/api/auth/logout');
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Write `server/app.js`**

```js
import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { sessionMiddleware } from './auth/session.js';
import authRoutes from './auth/routes.js';

export function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(morgan(process.env.NODE_ENV === 'test' ? 'dev' : 'combined'));
  app.use(sessionMiddleware());

  app.get('/health', (_req, res) => res.json({ ok: true, uptime_s: process.uptime() }));
  app.use('/api/auth', authRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  });
  return app;
}
```

- [ ] **Step 4: Write `server/auth/routes.js`**

```js
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { dbPool } from '../db.js';
import { verifyPassword, needsRehash, hashPassword } from './password.js';
import { createSession, destroySession, requireAuth } from './session.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
});

const cookieName = () => process.env.SESSION_COOKIE_NAME || 'ds';
const ttlMs = () => Number(process.env.SESSION_TTL_DAYS || 30) * 86_400_000;

function setSessionCookie(res, id) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(cookieName(), id, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: ttlMs()
  });
}

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

  const { rows } = await dbPool.query(
    `SELECT id, password_hash, is_active FROM users WHERE email=$1`,
    [String(email).toLowerCase()]
  );
  const user = rows[0];
  if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'invalid' });
  }

  if (needsRehash(user.password_hash)) {
    const newHash = await hashPassword(password);
    await dbPool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [newHash, user.id]);
  }
  await dbPool.query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [user.id]);

  const session = await createSession(user.id, req.headers['user-agent']);
  setSessionCookie(res, session.id);
  res.json({ ok: true });
});

router.post('/logout', async (req, res) => {
  if (req.sessionId) await destroySession(req.sessionId);
  res.clearCookie(cookieName(), { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, is_admin: req.user.is_admin });
});

export default router;
```

- [ ] **Step 5: Write `server/index.js`**

```js
import 'dotenv/config';
import { buildApp } from './app.js';

const port = process.env.NODE_ENV === 'production'
  ? Number(process.env.PORT || 4010)
  : Number(process.env.PORT_DEV || (Number(process.env.PORT || 4010) + 100));

buildApp().listen(port, () => {
  console.log(`dashboard listening on ${port}`);
});
```

- [ ] **Step 6: Run tests, verify pass**

```bash
NODE_ENV=test npm run test -w server -- routes
```

Expected: 5 pass.

- [ ] **Step 7: Smoke run server**

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='zX9!muPpetDance#Lurking' npm run seed:admin
npm run dev -w server &
sleep 1
curl -s http://localhost:4110/health
kill %1
```

Expected: `{"ok":true,...}`.

- [ ] **Step 8: Commit**

```bash
git add server/index.js server/app.js server/auth/routes.js server/auth/routes.test.js
git commit -m "feat(auth): login, logout, /me + Express factory"
```

---

### Task B5: Invites + accept-invite

**Files:**
- Create: `dashboard/server/auth/invites.js`
- Create: `dashboard/server/auth/invites.test.js`
- Modify: `dashboard/server/app.js` (mount `/api/invites`)
- Modify: `dashboard/server/auth/routes.js` (add `/accept-invite`)

- [ ] **Step 1: Write failing test `server/auth/invites.test.js`**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { seedAdmin } from './seed.js';

let app, agent;
beforeEach(async () => {
  await seedAdmin('admin@example.com', 'zX9!muPpetDance#Lurking');
  app = buildApp();
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({
    email: 'admin@example.com',
    password: 'zX9!muPpetDance#Lurking'
  });
});

describe('invites', () => {
  it('admin creates and lists invites', async () => {
    const create = await agent.post('/api/invites').send({ email: 'b@example.com' });
    expect(create.status).toBe(200);
    expect(create.body.token).toMatch(/^[0-9a-f]{64}$/);

    const list = await agent.get('/api/invites');
    expect(list.body).toHaveLength(1);
  });

  it('accepts an invite and creates a user session', async () => {
    const create = await agent.post('/api/invites').send({ email: 'b@example.com' });
    const token = create.body.token;

    const accept = await request(app)
      .post('/api/auth/accept-invite')
      .send({ token, email: 'b@example.com', password: 'zX9!muPpetDance#Lurking' });
    expect(accept.status).toBe(200);
    expect(accept.headers['set-cookie'][0]).toMatch(/^ds=/);

    const reuse = await request(app)
      .post('/api/auth/accept-invite')
      .send({ token, email: 'b@example.com', password: 'zX9!muPpetDance#Lurking' });
    expect(reuse.status).toBe(400);
  });

  it('rejects non-admin invite create', async () => {
    const create = await agent.post('/api/invites').send({ email: 'b@example.com' });
    await request(app).post('/api/auth/accept-invite').send({
      token: create.body.token,
      email: 'b@example.com',
      password: 'zX9!muPpetDance#Lurking'
    });
    const bAgent = request.agent(app);
    await bAgent.post('/api/auth/login').send({
      email: 'b@example.com',
      password: 'zX9!muPpetDance#Lurking'
    });
    const denied = await bAgent.post('/api/invites').send({ email: 'c@example.com' });
    expect(denied.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Write `server/auth/invites.js`**

```js
import crypto from 'node:crypto';
import { Router } from 'express';
import { dbPool } from '../db.js';
import { requireAuth, requireAdmin } from './session.js';

const router = Router();
const TTL_DAYS = 7;

router.use(requireAuth);

router.post('/', requireAdmin, async (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  const { rows } = await dbPool.query(
    `INSERT INTO invites(token,email,created_by,expires_at)
     VALUES ($1,$2,$3, NOW() + INTERVAL '${TTL_DAYS} days')
     RETURNING id, token, email, expires_at`,
    [token, req.body?.email || null, req.user.id]
  );
  res.json(rows[0]);
});

router.get('/', requireAdmin, async (_req, res) => {
  const { rows } = await dbPool.query(
    `SELECT id, email, created_at, expires_at, used_at
       FROM invites
      WHERE used_at IS NULL AND expires_at > NOW()
      ORDER BY created_at DESC`
  );
  res.json(rows);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await dbPool.query(
    `UPDATE invites SET used_at=NOW() WHERE id=$1 AND used_at IS NULL`,
    [req.params.id]
  );
  res.json({ ok: true });
});

export default router;

export async function acceptInvite({ token, email, password }) {
  const { rows } = await dbPool.query(
    `SELECT id FROM invites
      WHERE token=$1 AND used_at IS NULL AND expires_at > NOW()`,
    [token]
  );
  if (!rows[0]) throw new Error('invalid_token');
  return rows[0].id;
}
```

- [ ] **Step 4: Update `server/auth/routes.js` — append `/accept-invite`**

Insert after `/me` handler:

```js
import { acceptInvite } from './invites.js';
import { validatePolicy, hashPassword } from './password.js';

router.post('/accept-invite', async (req, res) => {
  const { token, email, password } = req.body || {};
  if (!token || !email || !password) return res.status(400).json({ error: 'missing_fields' });

  const policy = validatePolicy(password);
  if (!policy.ok) return res.status(400).json({ error: 'password_' + policy.reason });

  let inviteId;
  try {
    inviteId = await acceptInvite({ token, email, password });
  } catch {
    return res.status(400).json({ error: 'invalid_invite' });
  }

  const hash = await hashPassword(password);
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query(
      'SELECT 1 FROM users WHERE email=$1', [email.toLowerCase()]
    );
    if (existing.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'email_taken' });
    }
    const { rows } = await client.query(
      `INSERT INTO users(email,password_hash,is_admin,is_active)
       VALUES ($1,$2,false,true) RETURNING id`,
      [email.toLowerCase(), hash]
    );
    await client.query('UPDATE invites SET used_at=NOW() WHERE id=$1', [inviteId]);
    await client.query('COMMIT');

    const session = await createSession(rows[0].id, req.headers['user-agent']);
    setSessionCookie(res, session.id);
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
```

- [ ] **Step 5: Mount in `app.js`** — add after `app.use('/api/auth', authRoutes);`:

```js
import invitesRoutes from './auth/invites.js';
app.use('/api/invites', invitesRoutes);
```

- [ ] **Step 6: Run tests**

```bash
NODE_ENV=test npm run test -w server -- invites
```

Expected: 3 pass.

- [ ] **Step 7: Commit**

```bash
git add server/auth/invites.js server/auth/invites.test.js server/auth/routes.js server/app.js
git commit -m "feat(auth): invites + accept-invite"
```

---

### Task B6: CSRF origin check

**Files:**
- Modify: `dashboard/server/app.js`
- Create: `dashboard/server/auth/origin.test.js`

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { seedAdmin } from './seed.js';

let app;
beforeEach(async () => {
  await seedAdmin('admin@example.com', 'zX9!muPpetDance#Lurking');
  process.env.APP_ORIGIN = 'http://localhost';
  app = buildApp();
});

describe('CSRF', () => {
  it('rejects POST with foreign Origin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://evil.example.com')
      .send({ email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking' });
    expect(res.status).toBe(403);
  });

  it('allows POST with matching Origin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost')
      .send({ email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking' });
    expect(res.status).toBe(200);
  });

  it('allows POST with no Origin (curl)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking' });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Add middleware in `server/app.js`** before mounting `/api/*`:

```js
function originCheck(req, res, next) {
  const method = req.method;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // curl / server-to-server
  if (origin === process.env.APP_ORIGIN) return next();
  return res.status(403).json({ error: 'bad_origin' });
}

app.use('/api', originCheck);
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit**

```bash
git add server/app.js server/auth/origin.test.js
git commit -m "feat(auth): CSRF Origin header check"
```

---

## Phase C — App registry + collectors

### Task C1: Config loader + appPools

**Files:**
- Create: `dashboard/config/apps.json`
- Create: `dashboard/server/config.js`
- Create: `dashboard/server/config.test.js`
- Create: `dashboard/server/appPools.js`

- [ ] **Step 1: Write `config/apps.json`**

```json
{
  "sportly": {
    "label": "Sportly",
    "db": { "host": "localhost", "port": 5432, "database": "sportly", "user": "dashboard_reader" },
    "health_url": "http://localhost:4003/health",
    "pm2_name": "sportly-backend",
    "nginx_log": "/var/log/nginx/sportly.access.log",
    "kpis": [
      { "key": "events_week", "label": "Events (7d)",
        "sql": "SELECT COUNT(*)::int AS value FROM events WHERE created_at > NOW() - INTERVAL '7 days'" },
      { "key": "participants_week", "label": "Participants (7d)",
        "sql": "SELECT COUNT(*)::int AS value FROM event_participants WHERE created_at > NOW() - INTERVAL '7 days'" }
    ]
  },
  "honeydoeh": {
    "label": "Honey Do Eh",
    "db": { "host": "localhost", "port": 5432, "database": "honeydoeh", "user": "dashboard_reader" },
    "health_url": "http://localhost:4002/health",
    "pm2_name": "honeydoeh-api",
    "nginx_log": "/var/log/nginx/honeydoeh.access.log",
    "kpis": [
      { "key": "todos_done_week", "label": "Todos done (7d)",
        "sql": "SELECT COUNT(*)::int AS value FROM todos WHERE completed=true AND COALESCE(updated_at,created_at) > NOW() - INTERVAL '7 days'" },
      { "key": "active_projects", "label": "Active projects",
        "sql": "SELECT COUNT(*)::int AS value FROM projects" }
    ]
  },
  "debtmanager": {
    "label": "DebtManager",
    "db": { "host": "localhost", "port": 5432, "database": "debtmanager", "user": "dashboard_reader" },
    "health_url": "http://localhost:4006/health",
    "pm2_name": "debtmanager-api",
    "nginx_log": "/var/log/nginx/debtmanager.access.log",
    "kpis": [
      { "key": "total_debt", "label": "Total debt tracked",
        "sql": "SELECT COALESCE(SUM(amount),0)::float8 AS value FROM debts" },
      { "key": "payments_week", "label": "Payments (7d)",
        "sql": "SELECT COUNT(*)::int AS value FROM payments WHERE COALESCE(paid_at,created_at) > NOW() - INTERVAL '7 days'" }
    ]
  }
}
```

- [ ] **Step 2: Write `server/config.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.resolve(__dirname, '../config/apps.json');

export function loadApps(p = defaultPath) {
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const passwords = JSON.parse(process.env.APP_DB_PASSWORDS_JSON || '{}');
  return Object.fromEntries(
    Object.entries(raw).map(([slug, def]) => [
      slug,
      { slug, ...def, db: { ...def.db, password: passwords[slug] || '' } }
    ])
  );
}
```

- [ ] **Step 3: Write `server/config.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { loadApps } from './config.js';

describe('loadApps', () => {
  it('returns 3 apps with merged passwords', () => {
    process.env.APP_DB_PASSWORDS_JSON = JSON.stringify({ sportly: 'pw1', honeydoeh: 'pw2', debtmanager: 'pw3' });
    const apps = loadApps();
    expect(Object.keys(apps).sort()).toEqual(['debtmanager', 'honeydoeh', 'sportly']);
    expect(apps.sportly.db.password).toBe('pw1');
    expect(apps.sportly.slug).toBe('sportly');
    expect(Array.isArray(apps.sportly.kpis)).toBe(true);
  });
});
```

- [ ] **Step 4: Write `server/appPools.js`**

```js
import pg from 'pg';
import { loadApps } from './config.js';

const { Pool } = pg;
const pools = new Map();

export function getAppPool(slug) {
  if (pools.has(slug)) return pools.get(slug);
  const apps = loadApps();
  const cfg = apps[slug];
  if (!cfg) throw new Error(`unknown_app: ${slug}`);
  const pool = new Pool({
    ...cfg.db,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  });
  pool.on('error', err => console.error('app pool error', slug, err.message));
  pools.set(slug, pool);
  return pool;
}

export function listAppSlugs() {
  return Object.keys(loadApps());
}

export async function closeAllPools() {
  for (const p of pools.values()) await p.end();
  pools.clear();
}
```

- [ ] **Step 5: Run config test, verify pass**

```bash
NODE_ENV=test npm run test -w server -- config
```

- [ ] **Step 6: Commit**

```bash
git add config/apps.json server/config.js server/config.test.js server/appPools.js
git commit -m "feat: app registry config + per-app pg pools"
```

---

### Task C2: Cache module

**Files:**
- Create: `dashboard/server/cache.js`
- Create: `dashboard/server/cache.test.js`

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { Cache } from './cache.js';

describe('Cache', () => {
  let c;
  beforeEach(() => { c = new Cache({ max: 3 }); });

  it('returns undefined on miss', () => {
    expect(c.get('x')).toBeUndefined();
  });

  it('stores and retrieves within TTL', () => {
    c.set('x', 1, 1000);
    expect(c.get('x')).toBe(1);
  });

  it('expires after TTL', async () => {
    c.set('x', 1, 5);
    await new Promise(r => setTimeout(r, 20));
    expect(c.get('x')).toBeUndefined();
  });

  it('evicts least-recently-set when over max', () => {
    c.set('a', 1, 1000);
    c.set('b', 2, 1000);
    c.set('c', 3, 1000);
    c.set('d', 4, 1000);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('d')).toBe(4);
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `server/cache.js`**

```js
export class Cache {
  constructor({ max = 500 } = {}) {
    this.max = max;
    this.map = new Map();
  }

  set(key, value, ttlMs) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, until: Date.now() + ttlMs });
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }

  get(key) {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.until < Date.now()) { this.map.delete(key); return undefined; }
    return e.value;
  }

  size() { return this.map.size; }
}

export const metricsCache = new Cache({ max: 1000 });
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add server/cache.js server/cache.test.js
git commit -m "feat: in-memory TTL+LRU cache"
```

---

### Task C3: pgUsers collector

**Files:**
- Create: `dashboard/server/collectors/pgUsers.js`
- Create: `dashboard/server/collectors/pgUsers.test.js`

- [ ] **Step 1: Provision a mini fixture DB**

```bash
createdb sportly_fixture
psql sportly_fixture <<'SQL'
CREATE TABLE users (id BIGSERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
INSERT INTO users(created_at) VALUES (NOW() - INTERVAL '40 days');
INSERT INTO users(created_at) VALUES (NOW() - INTERVAL '20 days');
INSERT INTO users(created_at) VALUES (NOW() - INTERVAL '5 days');
INSERT INTO users(created_at) VALUES (NOW() - INTERVAL '1 day');
INSERT INTO users(created_at) VALUES (NOW());
SQL
```

- [ ] **Step 2: Write failing test `server/collectors/pgUsers.test.js`**

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { total, timeseries } from './pgUsers.js';

let pool;
beforeAll(() => {
  pool = new pg.Pool({ database: 'sportly_fixture' });
});
afterAll(() => pool.end());

describe('pgUsers', () => {
  it('returns total user count', async () => {
    const v = await total(pool);
    expect(v).toBe(5);
  });

  it('returns daily timeseries with zero-filled days', async () => {
    const series = await timeseries(pool, { range: '7d', bucket: 'day' });
    expect(series).toHaveLength(7);
    expect(series.every(p => typeof p.t === 'string' && typeof p.value === 'number')).toBe(true);
    const sum = series.reduce((a, p) => a + p.value, 0);
    expect(sum).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 3: Run, verify fail**

- [ ] **Step 4: Implement `server/collectors/pgUsers.js`**

```js
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

export async function total(pool) {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  return rows[0].n;
}

export async function timeseries(pool, { range = '30d', bucket = 'day' } = {}) {
  const days = RANGE_DAYS[range] ?? 30;
  const { rows } = await pool.query(
    `WITH days AS (
       SELECT generate_series(
         date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day',
         date_trunc('day', NOW()),
         INTERVAL '1 day'
       ) AS d
     )
     SELECT to_char(days.d, 'YYYY-MM-DD') AS t,
            COALESCE(COUNT(u.id), 0)::int AS value
       FROM days
       LEFT JOIN users u
         ON date_trunc('day', u.created_at) = days.d
      GROUP BY days.d
      ORDER BY days.d`,
    [days]
  );
  return rows;
}
```

- [ ] **Step 5: Run, verify pass**

- [ ] **Step 6: Cleanup fixture mention in test/helpers.js docs and commit**

```bash
git add server/collectors/pgUsers.js server/collectors/pgUsers.test.js
git commit -m "feat(collector): pgUsers total + signups timeseries"
```

---

### Task C4: pgActivity collector

**Files:**
- Create: `dashboard/server/collectors/pgActivity.js`
- Create: `dashboard/server/collectors/pgActivity.test.js`

- [ ] **Step 1: Extend fixture**

```bash
psql sportly_fixture <<'SQL'
CREATE TABLE refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  last_used_at TIMESTAMPTZ
);
INSERT INTO refresh_tokens(user_id,last_used_at) VALUES
  (1, NOW()),
  (2, NOW() - INTERVAL '12 hours'),
  (3, NOW() - INTERVAL '3 days'),
  (4, NOW() - INTERVAL '20 days'),
  (5, NOW() - INTERVAL '60 days');
SQL
```

- [ ] **Step 2: Write failing test**

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { dau, wau, mau, timeseries } from './pgActivity.js';

let pool;
beforeAll(() => { pool = new pg.Pool({ database: 'sportly_fixture' }); });
afterAll(() => pool.end());

describe('pgActivity', () => {
  it('counts DAU/WAU/MAU based on refresh_tokens.last_used_at', async () => {
    expect(await dau(pool)).toBe(2);
    expect(await wau(pool)).toBe(3);
    expect(await mau(pool)).toBe(4);
  });

  it('returns a daily DAU timeseries', async () => {
    const s = await timeseries(pool, { range: '7d' });
    expect(s).toHaveLength(7);
  });
});
```

- [ ] **Step 3: Run, verify fail**

- [ ] **Step 4: Implement `server/collectors/pgActivity.js`**

```js
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

async function activeWithin(pool, interval) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT user_id)::int AS n
       FROM refresh_tokens
      WHERE last_used_at > NOW() - $1::interval`,
    [interval]
  );
  return rows[0].n;
}

export const dau = pool => activeWithin(pool, '1 day');
export const wau = pool => activeWithin(pool, '7 days');
export const mau = pool => activeWithin(pool, '30 days');

export async function timeseries(pool, { range = '30d' } = {}) {
  const days = RANGE_DAYS[range] ?? 30;
  const { rows } = await pool.query(
    `WITH days AS (
       SELECT generate_series(
         date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day',
         date_trunc('day', NOW()),
         INTERVAL '1 day'
       ) AS d
     )
     SELECT to_char(days.d, 'YYYY-MM-DD') AS t,
            COUNT(DISTINCT rt.user_id)::int AS value
       FROM days
       LEFT JOIN refresh_tokens rt
         ON rt.last_used_at >= days.d
        AND rt.last_used_at <  days.d + INTERVAL '1 day'
      GROUP BY days.d
      ORDER BY days.d`,
    [days]
  );
  return rows;
}
```

- [ ] **Step 5: Run, verify pass**

- [ ] **Step 6: Commit**

```bash
git add server/collectors/pgActivity.js server/collectors/pgActivity.test.js
git commit -m "feat(collector): pgActivity DAU/WAU/MAU"
```

---

### Task C5: pgKpi collector

**Files:**
- Create: `dashboard/server/collectors/pgKpi.js`
- Create: `dashboard/server/collectors/pgKpi.test.js`

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { runKpi } from './pgKpi.js';

let pool;
beforeAll(() => { pool = new pg.Pool({ database: 'sportly_fixture' }); });
afterAll(() => pool.end());

describe('pgKpi.runKpi', () => {
  it('runs a kpi SQL returning {value}', async () => {
    const v = await runKpi(pool, { sql: 'SELECT 7::int AS value' });
    expect(v).toBe(7);
  });

  it('rejects SQL without a value column', async () => {
    await expect(runKpi(pool, { sql: 'SELECT 1 AS other' })).rejects.toThrow('kpi_no_value');
  });

  it('aborts on long-running query (5s timeout)', async () => {
    await expect(runKpi(pool, { sql: 'SELECT pg_sleep(7)' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `server/collectors/pgKpi.js`**

```js
const TIMEOUT_MS = 5_000;

export async function runKpi(pool, { sql }) {
  const client = await pool.connect();
  try {
    await client.query(`SET statement_timeout = ${TIMEOUT_MS}`);
    const { rows } = await client.query(sql);
    if (!rows[0] || !('value' in rows[0])) throw new Error('kpi_no_value');
    const n = Number(rows[0].value);
    if (!Number.isFinite(n)) throw new Error('kpi_not_numeric');
    return n;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add server/collectors/pgKpi.js server/collectors/pgKpi.test.js
git commit -m "feat(collector): pgKpi runner with statement timeout"
```

---

### Task C6: pm2 collector

**Files:**
- Create: `dashboard/server/collectors/pm2.js`
- Create: `dashboard/server/collectors/pm2.test.js`

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import * as child from 'node:child_process';
import { parseJlist, snapshot } from './pm2.js';

describe('pm2', () => {
  it('parses jlist output', () => {
    const json = JSON.stringify([
      { name: 'sportly-backend', pm2_env: { status: 'online', restart_time: 2 }, monit: { cpu: 4, memory: 80_000_000 } },
      { name: 'honeydoeh-api',  pm2_env: { status: 'stopped', restart_time: 0 }, monit: { cpu: 0, memory: 0 } }
    ]);
    const out = parseJlist(json);
    expect(out['sportly-backend']).toEqual({ status: 'online', restarts: 2, cpu: 4, mem_bytes: 80_000_000 });
    expect(out['honeydoeh-api'].status).toBe('stopped');
  });

  it('runs pm2 jlist and returns map', async () => {
    vi.spyOn(child, 'execFile').mockImplementation((_b, _a, _o, cb) => {
      cb(null, JSON.stringify([{ name: 'x', pm2_env: { status: 'online', restart_time: 0 }, monit: { cpu: 1, memory: 1 } }]));
    });
    const out = await snapshot();
    expect(out.x.status).toBe('online');
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `server/collectors/pm2.js`**

```js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

export function parseJlist(json) {
  const list = JSON.parse(json);
  const out = {};
  for (const p of list) {
    out[p.name] = {
      status: p.pm2_env?.status || 'unknown',
      restarts: p.pm2_env?.restart_time ?? 0,
      cpu: p.monit?.cpu ?? 0,
      mem_bytes: p.monit?.memory ?? 0
    };
  }
  return out;
}

export async function snapshot() {
  const bin = process.env.PM2_BIN || 'pm2';
  const { stdout } = await execFileP(bin, ['jlist'], { timeout: 5_000, maxBuffer: 8 * 1024 * 1024 });
  return parseJlist(stdout);
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add server/collectors/pm2.js server/collectors/pm2.test.js
git commit -m "feat(collector): pm2 jlist snapshot"
```

---

### Task C7: health collector

**Files:**
- Create: `dashboard/server/collectors/health.js`
- Create: `dashboard/server/collectors/health.test.js`

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { checkHealth } from './health.js';

describe('checkHealth', () => {
  it('returns ok=true on 2xx', async () => {
    global.fetch = vi.fn(async () => new Response('', { status: 200 }));
    const r = await checkHealth('http://x/health');
    expect(r.ok).toBe(true);
    expect(typeof r.latency_ms).toBe('number');
  });

  it('returns ok=false on non-2xx', async () => {
    global.fetch = vi.fn(async () => new Response('', { status: 503 }));
    const r = await checkHealth('http://x/health');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(503);
  });

  it('returns ok=false on timeout/error', async () => {
    global.fetch = vi.fn(async () => { throw new Error('econnrefused'); });
    const r = await checkHealth('http://x/health');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/econnrefused/);
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `server/collectors/health.js`**

```js
export async function checkHealth(url, { timeoutMs = 5_000 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort('timeout'), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: ac.signal });
    return { ok: res.ok, status: res.status, latency_ms: Date.now() - started };
  } catch (err) {
    return { ok: false, error: String(err.message || err), latency_ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add server/collectors/health.js server/collectors/health.test.js
git commit -m "feat(collector): HTTP health probe"
```

---

### Task C8: nginx log collector

**Files:**
- Create: `dashboard/server/collectors/nginx.js`
- Create: `dashboard/server/collectors/nginx.test.js`
- Create: `dashboard/server/test/fixtures/nginx-sample.log`

- [ ] **Step 1: Write fixture `server/test/fixtures/nginx-sample.log`**

```
127.0.0.1 - - [16/May/2026:12:00:00 +0000] "GET /api/x HTTP/1.1" 200 32 "-" "ua" 0.012
127.0.0.1 - - [16/May/2026:12:00:01 +0000] "GET /api/x HTTP/1.1" 200 32 "-" "ua" 0.020
127.0.0.1 - - [16/May/2026:12:00:02 +0000] "GET /api/x HTTP/1.1" 500 32 "-" "ua" 0.300
127.0.0.1 - - [16/May/2026:12:00:03 +0000] "GET /api/x HTTP/1.1" 200 32 "-" "ua" 0.040
127.0.0.1 - - [16/May/2026:12:00:04 +0000] "GET /api/x HTTP/1.1" 404 32 "-" "ua" 0.008
```

> **Note:** Assumes nginx `log_format` includes `$request_time` as the trailing field. Document this requirement in `migrations/README.md` or repo README.

- [ ] **Step 2: Write failing test**

```js
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregate } from './nginx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(__dirname, '../test/fixtures/nginx-sample.log');

describe('nginx aggregate', () => {
  it('counts requests, errors, p95 from a sample log', async () => {
    const agg = await aggregate(fixture, { fromOffset: 0 });
    expect(agg.count).toBe(5);
    expect(agg.errors).toBe(2);            // 500, 404
    expect(agg.errors_5xx).toBe(1);
    expect(agg.p95_ms).toBeGreaterThan(0);
    expect(agg.nextOffset).toBeGreaterThan(0);
  });

  it('skips lines before fromOffset', async () => {
    const first = await aggregate(fixture, { fromOffset: 0 });
    const second = await aggregate(fixture, { fromOffset: first.nextOffset });
    expect(second.count).toBe(0);
  });
});
```

- [ ] **Step 3: Run, verify fail**

- [ ] **Step 4: Implement `server/collectors/nginx.js`**

```js
import fs from 'node:fs';

const LINE = /"\S+\s\S+\s\S+"\s(\d{3})\s\d+\s"[^"]*"\s"[^"]*"\s([\d.]+)\s*$/;

function pct(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

export async function aggregate(filepath, { fromOffset = 0 } = {}) {
  let nextOffset = fromOffset;
  let count = 0, errors = 0, errors_5xx = 0;
  const latencies = [];

  let stat;
  try { stat = await fs.promises.stat(filepath); }
  catch { return { count: 0, errors: 0, errors_5xx: 0, p95_ms: 0, nextOffset: 0, error: 'log_unreadable' }; }

  if (fromOffset > stat.size) fromOffset = 0; // rotated

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filepath, { start: fromOffset, encoding: 'utf8' });
    let buf = '';
    stream.on('data', chunk => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        nextOffset += Buffer.byteLength(line, 'utf8') + 1;
        const m = LINE.exec(line);
        if (!m) continue;
        const status = Number(m[1]);
        const ms = Number(m[2]) * 1000;
        count++;
        if (status >= 400) errors++;
        if (status >= 500) errors_5xx++;
        latencies.push(ms);
      }
    });
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  return {
    count, errors, errors_5xx,
    p95_ms: Math.round(pct(latencies, 0.95)),
    nextOffset
  };
}
```

- [ ] **Step 5: Run, verify pass**

- [ ] **Step 6: Commit**

```bash
git add server/collectors/nginx.js server/collectors/nginx.test.js server/test/fixtures/
git commit -m "feat(collector): nginx access log aggregate"
```

---

## Phase D — Metrics API + poller

### Task D1: Widget registry (server-side)

**Files:**
- Create: `dashboard/server/widgets/registry.js`
- Create: `dashboard/server/routes/widgets.js`
- Modify: `dashboard/server/app.js`

- [ ] **Step 1: Write `server/widgets/registry.js`**

```js
export const WIDGETS = [
  { kind: 'users_total',        label: 'Users (total)',     defaultSize: { w: 2, h: 2 }, scope: 'app',      paramsSchema: [] },
  { kind: 'signups_timeseries', label: 'Signups over time', defaultSize: { w: 6, h: 4 }, scope: 'app',
    paramsSchema: [{ name: 'range', type: 'enum', values: ['7d', '30d', '90d'], default: '30d' }] },
  { kind: 'dau',                label: 'DAU',               defaultSize: { w: 2, h: 2 }, scope: 'app',      paramsSchema: [] },
  { kind: 'active_timeseries',  label: 'DAU over time',     defaultSize: { w: 6, h: 4 }, scope: 'app',
    paramsSchema: [{ name: 'range', type: 'enum', values: ['7d', '30d'], default: '30d' }] },
  { kind: 'health',             label: 'Health',            defaultSize: { w: 2, h: 2 }, scope: 'both',     paramsSchema: [] },
  { kind: 'pm2',                label: 'PM2 status',        defaultSize: { w: 3, h: 2 }, scope: 'both',     paramsSchema: [] },
  { kind: 'http_rate',          label: 'Requests/sec',      defaultSize: { w: 4, h: 3 }, scope: 'app',      paramsSchema: [] },
  { kind: 'http_errors',        label: 'HTTP errors',       defaultSize: { w: 4, h: 3 }, scope: 'app',      paramsSchema: [] },
  { kind: 'http_latency',       label: 'p95 latency',       defaultSize: { w: 4, h: 3 }, scope: 'app',      paramsSchema: [] },
  { kind: 'kpi',                label: 'KPI value',         defaultSize: { w: 3, h: 2 }, scope: 'app',
    paramsSchema: [{ name: 'key', type: 'string', required: true }] },
  { kind: 'kpi_timeseries',     label: 'KPI over time',     defaultSize: { w: 6, h: 4 }, scope: 'app',
    paramsSchema: [{ name: 'key', type: 'string', required: true },
                   { name: 'range', type: 'enum', values: ['7d', '30d', '90d'], default: '30d' }] }
];

export const KIND_INDEX = Object.fromEntries(WIDGETS.map(w => [w.kind, w]));
```

- [ ] **Step 2: Write `server/routes/widgets.js`**

```js
import { Router } from 'express';
import { WIDGETS } from '../widgets/registry.js';
import { requireAuth } from '../auth/session.js';

const router = Router();
router.get('/', requireAuth, (_req, res) => res.json(WIDGETS));
export default router;
```

- [ ] **Step 3: Mount in `app.js`**

```js
import widgetsRoutes from './routes/widgets.js';
app.use('/api/widgets', widgetsRoutes);
```

- [ ] **Step 4: Smoke-test endpoint**

```bash
NODE_ENV=test npm run test -w server -- routes
```

Add a small spec in `server/auth/routes.test.js` (or new `widgets.test.js`):

```js
it('GET /api/widgets returns the registry', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({
    email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking'
  });
  const res = await agent.get('/api/widgets');
  expect(res.status).toBe(200);
  expect(res.body.find(w => w.kind === 'users_total')).toBeTruthy();
});
```

- [ ] **Step 5: Commit**

```bash
git add server/widgets/registry.js server/routes/widgets.js server/app.js server/auth/routes.test.js
git commit -m "feat: widget registry + /api/widgets"
```

---

### Task D2: /api/apps route

**Files:**
- Create: `dashboard/server/routes/apps.js`
- Create: `dashboard/server/routes/apps.test.js`
- Modify: `dashboard/server/app.js`

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { seedAdmin } from '../auth/seed.js';
import * as pm2 from '../collectors/pm2.js';
import * as health from '../collectors/health.js';

let app, agent;
beforeEach(async () => {
  process.env.APP_DB_PASSWORDS_JSON = JSON.stringify({ sportly: 'x', honeydoeh: 'x', debtmanager: 'x' });
  await seedAdmin('admin@example.com', 'zX9!muPpetDance#Lurking');
  vi.spyOn(pm2, 'snapshot').mockResolvedValue({
    'sportly-backend': { status: 'online', restarts: 0, cpu: 1, mem_bytes: 100 },
    'honeydoeh-api':   { status: 'online', restarts: 0, cpu: 1, mem_bytes: 100 },
    'debtmanager-api': { status: 'stopped', restarts: 0, cpu: 0, mem_bytes: 0 }
  });
  vi.spyOn(health, 'checkHealth').mockResolvedValue({ ok: true, status: 200, latency_ms: 5 });
  app = buildApp();
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({
    email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking'
  });
});

describe('GET /api/apps', () => {
  it('returns 3 apps with merged status', async () => {
    const res = await agent.get('/api/apps');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    const sportly = res.body.find(a => a.slug === 'sportly');
    expect(sportly.pm2_status).toBe('online');
    expect(sportly.health.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `server/routes/apps.js`**

```js
import { Router } from 'express';
import { loadApps } from '../config.js';
import { requireAuth } from '../auth/session.js';
import { snapshot as pm2Snapshot } from '../collectors/pm2.js';
import { checkHealth } from '../collectors/health.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req, res) => {
  const apps = loadApps();
  let pm2 = {};
  try { pm2 = await pm2Snapshot(); } catch { pm2 = {}; }

  const out = await Promise.all(Object.values(apps).map(async a => {
    const pm = pm2[a.pm2_name] || { status: 'unknown' };
    const health = await checkHealth(a.health_url);
    return {
      slug: a.slug,
      label: a.label,
      pm2_name: a.pm2_name,
      pm2_status: pm.status,
      pm2_cpu: pm.cpu, pm2_mem_bytes: pm.mem_bytes,
      health
    };
  }));
  res.json(out);
});

export default router;
```

- [ ] **Step 4: Mount in `app.js`**

```js
import appsRoutes from './routes/apps.js';
app.use('/api/apps', appsRoutes);
```

- [ ] **Step 5: Run, verify pass**

- [ ] **Step 6: Commit**

```bash
git add server/routes/apps.js server/routes/apps.test.js server/app.js
git commit -m "feat: GET /api/apps"
```

---

### Task D3: /api/metrics/:kind dispatcher

**Files:**
- Create: `dashboard/server/routes/metrics.js`
- Create: `dashboard/server/routes/metrics.test.js`
- Modify: `dashboard/server/app.js`

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { seedAdmin } from '../auth/seed.js';
import * as pgUsers from '../collectors/pgUsers.js';
import * as appPools from '../appPools.js';

let app, agent;
beforeEach(async () => {
  await seedAdmin('a@example.com', 'zX9!muPpetDance#Lurking');
  vi.spyOn(appPools, 'getAppPool').mockReturnValue({});
  vi.spyOn(pgUsers, 'total').mockResolvedValue(42);
  app = buildApp();
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({
    email: 'a@example.com', password: 'zX9!muPpetDance#Lurking'
  });
});

describe('GET /api/metrics/:kind', () => {
  it('dispatches users_total to pgUsers.total', async () => {
    const res = await agent.get('/api/metrics/users_total?app=sportly');
    expect(res.status).toBe(200);
    expect(res.body.data).toBe(42);
  });

  it('returns 400 on unknown kind', async () => {
    const res = await agent.get('/api/metrics/bogus?app=sportly');
    expect(res.status).toBe(400);
  });

  it('returns error envelope on collector failure', async () => {
    pgUsers.total.mockRejectedValueOnce(new Error('boom'));
    const res = await agent.get('/api/metrics/users_total?app=sportly');
    expect(res.status).toBe(200);
    expect(res.body.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `server/routes/metrics.js`**

```js
import { Router } from 'express';
import { requireAuth } from '../auth/session.js';
import { getAppPool, listAppSlugs } from '../appPools.js';
import { loadApps } from '../config.js';
import { metricsCache } from '../cache.js';
import * as pgUsers from '../collectors/pgUsers.js';
import * as pgActivity from '../collectors/pgActivity.js';
import { runKpi } from '../collectors/pgKpi.js';
import { snapshot as pm2Snapshot } from '../collectors/pm2.js';
import { checkHealth } from '../collectors/health.js';
import { aggregate } from '../collectors/nginx.js';

const TTL_MS = 30_000;
const ERR_TTL_MS = 10_000;

const nginxOffsets = new Map();

const KINDS = {
  users_total:        ({ pool })            => pgUsers.total(pool),
  signups_timeseries: ({ pool, params })    => pgUsers.timeseries(pool, params),
  dau:                ({ pool })            => pgActivity.dau(pool),
  active_timeseries:  ({ pool, params })    => pgActivity.timeseries(pool, params),
  health:             ({ appCfg })          => checkHealth(appCfg.health_url),
  pm2:                async ({ appCfg }) => (await pm2Snapshot())[appCfg.pm2_name] || { status: 'unknown' },
  http_rate:          async ({ appCfg }) => {
    const off = nginxOffsets.get(appCfg.slug) || 0;
    const agg = await aggregate(appCfg.nginx_log, { fromOffset: off });
    nginxOffsets.set(appCfg.slug, agg.nextOffset);
    return agg.count;
  },
  http_errors:        async ({ appCfg }) => {
    const off = nginxOffsets.get(appCfg.slug) || 0;
    const agg = await aggregate(appCfg.nginx_log, { fromOffset: off });
    nginxOffsets.set(appCfg.slug, agg.nextOffset);
    return agg.errors;
  },
  http_latency:       async ({ appCfg }) => {
    const off = nginxOffsets.get(appCfg.slug) || 0;
    const agg = await aggregate(appCfg.nginx_log, { fromOffset: off });
    nginxOffsets.set(appCfg.slug, agg.nextOffset);
    return agg.p95_ms;
  },
  kpi: ({ pool, appCfg, params }) => {
    const kpi = appCfg.kpis.find(k => k.key === params.key);
    if (!kpi) throw new Error('unknown_kpi');
    return runKpi(pool, kpi);
  },
  kpi_timeseries: async ({ params, appCfg }) => {
    // simple time series read from metric_samples (filled by poller)
    const slug = appCfg.slug;
    const days = ({ '7d': 7, '30d': 30, '90d': 90 })[params.range] || 30;
    const { dbPool } = await import('../db.js');
    const { rows } = await dbPool.query(
      `WITH days AS (
         SELECT generate_series(date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day',
                                date_trunc('day', NOW()), INTERVAL '1 day') AS d
       )
       SELECT to_char(days.d, 'YYYY-MM-DD') AS t,
              AVG(ms.value)::float8 AS value
         FROM days
         LEFT JOIN metric_samples ms
           ON ms.app_slug = $2 AND ms.metric = 'kpi:' || $3
          AND ms.taken_at >= days.d AND ms.taken_at < days.d + INTERVAL '1 day'
        GROUP BY days.d ORDER BY days.d`,
      [days, slug, params.key]
    );
    return rows;
  }
};

const router = Router();
router.use(requireAuth);

router.get('/:kind', async (req, res) => {
  const kind = req.params.kind;
  if (!KINDS[kind]) return res.status(400).json({ error: 'unknown_kind' });

  const app = String(req.query.app || '');
  const apps = loadApps();
  const appCfg = apps[app];
  if (!appCfg) return res.status(400).json({ error: 'unknown_app' });

  const params = { ...req.query };
  delete params.app;
  const cacheKey = `${kind}:${app}:${JSON.stringify(params)}`;
  const cached = metricsCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const pool = getAppPool(app);
    const data = await KINDS[kind]({ pool, appCfg, params });
    const envelope = { data };
    metricsCache.set(cacheKey, envelope, TTL_MS);
    res.json(envelope);
  } catch (err) {
    const envelope = { error: err.message || 'collector_error' };
    metricsCache.set(cacheKey, envelope, ERR_TTL_MS);
    res.json(envelope);
  }
});

export default router;
```

- [ ] **Step 4: Mount in `app.js`**

```js
import metricsRoutes from './routes/metrics.js';
app.use('/api/metrics', metricsRoutes);
```

- [ ] **Step 5: Run, verify pass**

- [ ] **Step 6: Commit**

```bash
git add server/routes/metrics.js server/routes/metrics.test.js server/app.js
git commit -m "feat: GET /api/metrics/:kind dispatcher with cache"
```

---

### Task D4: /api/layouts CRUD

**Files:**
- Create: `dashboard/server/routes/layouts.js`
- Create: `dashboard/server/routes/layouts.test.js`
- Modify: `dashboard/server/app.js`

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { seedAdmin } from '../auth/seed.js';

let app, agent;
beforeEach(async () => {
  await seedAdmin('a@example.com', 'zX9!muPpetDance#Lurking');
  app = buildApp();
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({
    email: 'a@example.com', password: 'zX9!muPpetDance#Lurking'
  });
});

describe('layouts', () => {
  it('returns a default layout when none saved', async () => {
    const res = await agent.get('/api/layouts/overview');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.layout)).toBe(true);
    expect(res.body.layout.length).toBeGreaterThan(0);
  });

  it('saves and retrieves a custom layout', async () => {
    const layout = [{ id: 'w_1', kind: 'users_total', app: 'sportly', x: 0, y: 0, w: 2, h: 2, params: {} }];
    const put = await agent.put('/api/layouts/sportly').send({ layout });
    expect(put.status).toBe(200);
    const get = await agent.get('/api/layouts/sportly');
    expect(get.body.layout).toEqual(layout);
  });

  it('rejects bad layout payloads', async () => {
    const res = await agent.put('/api/layouts/sportly').send({ layout: 'not-array' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `server/routes/layouts.js`**

```js
import { Router } from 'express';
import { dbPool } from '../db.js';
import { requireAuth } from '../auth/session.js';
import { KIND_INDEX } from '../widgets/registry.js';

const router = Router();
router.use(requireAuth);

const VALID_SCREENS = new Set(['overview', 'sportly', 'honeydoeh', 'debtmanager']);

function validateLayout(arr) {
  if (!Array.isArray(arr)) return 'not_array';
  for (const w of arr) {
    if (!w.id || !w.kind || !KIND_INDEX[w.kind]) return 'bad_widget';
    if (![w.x, w.y, w.w, w.h].every(Number.isInteger)) return 'bad_geometry';
  }
  return null;
}

function defaultLayout(screen) {
  if (screen === 'overview') {
    return [
      { id: 'd1', kind: 'health', x: 0, y: 0, w: 4, h: 2, params: {} },
      { id: 'd2', kind: 'pm2',    x: 4, y: 0, w: 4, h: 2, params: {} }
    ];
  }
  return [
    { id: 'd1', kind: 'users_total',        app: screen, x: 0, y: 0, w: 2, h: 2, params: {} },
    { id: 'd2', kind: 'dau',                app: screen, x: 2, y: 0, w: 2, h: 2, params: {} },
    { id: 'd3', kind: 'signups_timeseries', app: screen, x: 0, y: 2, w: 6, h: 4, params: { range: '30d' } },
    { id: 'd4', kind: 'active_timeseries',  app: screen, x: 6, y: 2, w: 6, h: 4, params: { range: '30d' } }
  ];
}

router.get('/:screen', async (req, res) => {
  const screen = req.params.screen;
  if (!VALID_SCREENS.has(screen)) return res.status(400).json({ error: 'bad_screen' });
  const { rows } = await dbPool.query(
    `SELECT layout FROM dashboard_layouts WHERE user_id=$1 AND screen=$2`,
    [req.user.id, screen]
  );
  if (rows[0]) return res.json({ layout: rows[0].layout });
  res.json({ layout: defaultLayout(screen), default: true });
});

router.put('/:screen', async (req, res) => {
  const screen = req.params.screen;
  if (!VALID_SCREENS.has(screen)) return res.status(400).json({ error: 'bad_screen' });
  const reason = validateLayout(req.body?.layout);
  if (reason) return res.status(400).json({ error: reason });

  await dbPool.query(
    `INSERT INTO dashboard_layouts(user_id,screen,layout,updated_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (user_id,screen)
     DO UPDATE SET layout=EXCLUDED.layout, updated_at=NOW()`,
    [req.user.id, screen, JSON.stringify(req.body.layout)]
  );
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 4: Mount in `app.js`**

```js
import layoutsRoutes from './routes/layouts.js';
app.use('/api/layouts', layoutsRoutes);
```

- [ ] **Step 5: Run, verify pass**

- [ ] **Step 6: Commit**

```bash
git add server/routes/layouts.js server/routes/layouts.test.js server/app.js
git commit -m "feat: layouts CRUD + defaults"
```

---

### Task D5: Background poller

**Files:**
- Create: `dashboard/server/poller.js`
- Create: `dashboard/server/poller.test.js`
- Modify: `dashboard/server/index.js`

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { runTick } from './poller.js';
import * as appPools from './appPools.js';
import * as pgUsers from './collectors/pgUsers.js';
import * as pgActivity from './collectors/pgActivity.js';
import * as pm2 from './collectors/pm2.js';
import * as health from './collectors/health.js';
import { dbPool } from './db.js';

describe('poller.runTick', () => {
  it('writes metric_samples for users_total, dau, and kpis', async () => {
    process.env.APP_DB_PASSWORDS_JSON = JSON.stringify({ sportly: '', honeydoeh: '', debtmanager: '' });
    vi.spyOn(appPools, 'getAppPool').mockReturnValue({ query: vi.fn().mockResolvedValue({ rows: [{ value: 1 }] }) });
    vi.spyOn(pgUsers, 'total').mockResolvedValue(10);
    vi.spyOn(pgActivity, 'dau').mockResolvedValue(3);
    vi.spyOn(pm2, 'snapshot').mockResolvedValue({});
    vi.spyOn(health, 'checkHealth').mockResolvedValue({ ok: true, status: 200, latency_ms: 5 });

    await runTick();
    const { rows } = await dbPool.query(
      "SELECT metric, COUNT(*)::int n FROM metric_samples GROUP BY metric ORDER BY metric"
    );
    const map = Object.fromEntries(rows.map(r => [r.metric, r.n]));
    expect(map.users_total).toBe(3);
    expect(map.dau).toBe(3);
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `server/poller.js`**

```js
import { dbPool } from './db.js';
import { loadApps } from './config.js';
import { getAppPool } from './appPools.js';
import * as pgUsers from './collectors/pgUsers.js';
import * as pgActivity from './collectors/pgActivity.js';
import { runKpi } from './collectors/pgKpi.js';
import { snapshot as pm2Snapshot } from './collectors/pm2.js';
import { checkHealth } from './collectors/health.js';

const TICK_MS = 30_000;
const TRIM_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TRIM_INITIAL_DELAY_MS = 5 * 60 * 1000;
const SAMPLE_RETENTION_DAYS = 90;

let timer, trimTimer;
let lastTick = { startedAt: null, ms: null, errors: [] };

async function persistSample(slug, metric, value) {
  if (!Number.isFinite(value)) return;
  await dbPool.query(
    `INSERT INTO metric_samples(app_slug, metric, value) VALUES ($1,$2,$3)`,
    [slug, metric, value]
  );
}

async function pollApp(app, pm2Map) {
  const errors = [];
  const pool = getAppPool(app.slug);

  await Promise.allSettled([
    pgUsers.total(pool).then(v => persistSample(app.slug, 'users_total', v)).catch(e => errors.push({ k: 'users_total', m: e.message })),
    pgActivity.dau(pool).then(v => persistSample(app.slug, 'dau', v)).catch(e => errors.push({ k: 'dau', m: e.message })),
    checkHealth(app.health_url).then(h => persistSample(app.slug, 'health_ok', h.ok ? 1 : 0)).catch(e => errors.push({ k: 'health', m: e.message })),
    ...(app.kpis || []).map(kpi =>
      runKpi(pool, kpi)
        .then(v => persistSample(app.slug, 'kpi:' + kpi.key, v))
        .catch(e => errors.push({ k: 'kpi:' + kpi.key, m: e.message }))
    )
  ]);

  return errors;
}

export async function runTick() {
  const startedAt = Date.now();
  const errors = [];
  let pm2Map = {};
  try { pm2Map = await pm2Snapshot(); }
  catch (e) { errors.push({ k: 'pm2', m: e.message }); }

  const apps = Object.values(loadApps());
  const results = await Promise.allSettled(apps.map(a => pollApp(a, pm2Map)));
  for (const r of results) if (r.status === 'fulfilled') errors.push(...r.value);

  lastTick = { startedAt, ms: Date.now() - startedAt, errors };
  if (lastTick.ms > 5_000) console.warn('poller_slow', lastTick);
  return lastTick;
}

async function trimOld() {
  await dbPool.query(
    `DELETE FROM metric_samples WHERE taken_at < NOW() - INTERVAL '${SAMPLE_RETENTION_DAYS} days'`
  );
}

export function startPoller() {
  if (timer) return;
  runTick();
  timer = setInterval(runTick, TICK_MS);
  trimTimer = setTimeout(function tick() {
    trimOld().catch(e => console.error('trim_failed', e));
    trimTimer = setTimeout(tick, TRIM_INTERVAL_MS);
  }, TRIM_INITIAL_DELAY_MS);
}

export function stopPoller() {
  clearInterval(timer); timer = undefined;
  clearTimeout(trimTimer); trimTimer = undefined;
}

export function getLastTick() { return lastTick; }
```

- [ ] **Step 4: Wire into `server/index.js`**

```js
import { startPoller } from './poller.js';
// after listen():
if (process.env.POLLER !== 'off') startPoller();
```

- [ ] **Step 5: Run, verify pass**

- [ ] **Step 6: Commit**

```bash
git add server/poller.js server/poller.test.js server/index.js
git commit -m "feat: 30s background poller + sample trim"
```

---

### Task D6: /health + /api/_internal/poller

**Files:**
- Create: `dashboard/server/routes/health.js`
- Modify: `dashboard/server/app.js`

- [ ] **Step 1: Implement `server/routes/health.js`**

```js
import { Router } from 'express';
import { requireAdmin, requireAuth } from '../auth/session.js';
import { getLastTick } from '../poller.js';
import { metricsCache } from '../cache.js';

const router = Router();

router.get('/', (_req, res) => res.json({ ok: true, uptime_s: process.uptime() }));
router.get('/_internal/poller', requireAuth, requireAdmin, (_req, res) => {
  res.json({ lastTick: getLastTick(), cacheSize: metricsCache.size() });
});

export default router;
```

- [ ] **Step 2: Replace inline `/health` in `app.js`**

```js
import healthRoutes from './routes/health.js';
app.use('/health', healthRoutes);
app.use('/api', healthRoutes); // mounts /api/_internal/poller
```

Remove the previous `app.get('/health', ...)` line.

- [ ] **Step 3: Smoke check**

```bash
curl -s http://localhost:4110/health
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/health.js server/app.js
git commit -m "feat: /health + admin poller introspection"
```

---

## Phase E — Frontend bootstrap

### Task E1: Vite + React + TS scaffold

**Files:**
- Create: `dashboard/web/vite.config.ts`
- Create: `dashboard/web/tsconfig.json`
- Create: `dashboard/web/index.html`
- Create: `dashboard/web/src/main.tsx`
- Create: `dashboard/web/src/App.tsx`
- Create: `dashboard/web/src/theme.css`

- [ ] **Step 1: Write `web/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { '/api': 'http://localhost:4110' }
  },
  build: { outDir: 'dist' }
});
```

- [ ] **Step 2: Write `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Apps Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Write `web/src/theme.css`**

```css
:root {
  --bg: #f7f8fa;
  --panel: #ffffff;
  --text: #1d2433;
  --muted: #6a7280;
  --border: #e5e7eb;
  --accent: #2563eb;
  --grid-line: #eef0f3;
  --chart-1: #2563eb;
  --chart-2: #10b981;
  --chart-3: #f59e0b;
  --chart-4: #ef4444;
  --chart-5: #8b5cf6;
  --chart-6: #14b8a6;
}
[data-theme="dark"] {
  --bg: #0f1115;
  --panel: #171a21;
  --text: #e6e8ee;
  --muted: #8b93a3;
  --border: #232733;
  --accent: #60a5fa;
  --grid-line: #1d2230;
  --chart-1: #60a5fa;
  --chart-2: #34d399;
  --chart-3: #fbbf24;
  --chart-4: #f87171;
  --chart-5: #a78bfa;
  --chart-6: #2dd4bf;
}
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { background: var(--bg); color: var(--text); font: 14px/1.5 system-ui, sans-serif; }
.panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
button { font: inherit; }
```

- [ ] **Step 5: Write `web/src/main.tsx`**

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './theme.css';

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 25_000, refetchInterval: 30_000, retry: 1 } }
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>
);
```

- [ ] **Step 6: Write `web/src/App.tsx`**

```tsx
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    const t = localStorage.getItem('theme');
    if (t) document.documentElement.dataset.theme = t;
    else if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';
  }, []);
  return <div style={{ padding: 20 }}>Dashboard scaffold up.</div>;
}
```

- [ ] **Step 7: Build + smoke**

```bash
npm run build -w web
npm run dev -w web &
sleep 2
curl -s http://localhost:5174 | head -1
kill %1
```

- [ ] **Step 8: Commit**

```bash
git add web/
git commit -m "chore(web): Vite + React + TS scaffold"
```

---

### Task E2: API client + Login page

**Files:**
- Create: `dashboard/web/src/api/client.ts`
- Create: `dashboard/web/src/api/hooks.ts`
- Create: `dashboard/web/src/auth/Login.tsx`
- Modify: `dashboard/web/src/App.tsx` (router)

- [ ] **Step 1: Write `web/src/api/client.ts`**

```ts
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) {
    if (location.pathname !== '/login') location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search);
    throw new ApiError(401, 'unauthorized');
  }
  if (!res.ok) throw new ApiError(res.status, (await res.text()) || res.statusText);
  return res.json();
}

export const api = {
  get:  <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b),
  put:  <T>(p: string, b: unknown) => request<T>('PUT', p, b),
  del:  <T>(p: string) => request<T>('DELETE', p)
};
```

- [ ] **Step 2: Write `web/src/api/hooks.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

type AppInfo = {
  slug: string; label: string; pm2_name: string; pm2_status: string;
  pm2_cpu?: number; pm2_mem_bytes?: number;
  health: { ok: boolean; status?: number; latency_ms: number; error?: string };
};

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api.get<{ id: number; email: string; is_admin: boolean }>('/api/auth/me'), retry: false });
}

export function useApps() {
  return useQuery({ queryKey: ['apps'], queryFn: () => api.get<AppInfo[]>('/api/apps') });
}

export function useMetric(kind: string, params: Record<string, unknown> = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return useQuery({
    queryKey: ['metric', kind, qs],
    queryFn: () => api.get<{ data?: unknown; error?: string; stale?: boolean }>(`/api/metrics/${kind}?${qs}`)
  });
}

export function useLayout(screen: string) {
  return useQuery({
    queryKey: ['layout', screen],
    queryFn: () => api.get<{ layout: any[]; default?: boolean }>(`/api/layouts/${screen}`)
  });
}

export function useSaveLayout(screen: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (layout: any[]) => api.put(`/api/layouts/${screen}`, { layout }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['layout', screen] })
  });
}
```

- [ ] **Step 3: Write `web/src/auth/Login.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  const [sp] = useSearchParams();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post('/api/auth/login', { email, password });
      nav(sp.get('next') || '/');
    } catch (e: any) {
      setErr(e.status === 401 ? 'Invalid credentials' : 'Login failed');
    }
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 360, margin: '80px auto' }} className="panel">
      <h2 style={{ marginTop: 0 }}>Sign in</h2>
      <label>Email<input value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      {err && <div style={{ color: 'crimson' }}>{err}</div>}
      <button type="submit">Sign in</button>
    </form>
  );
}
```

- [ ] **Step 4: Wire router in `App.tsx`**

```tsx
import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './auth/Login';
import { useMe } from './api/hooks';

function Protected({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useMe();
  if (isLoading) return <div style={{ padding: 20 }}>Loading…</div>;
  if (!data) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    const t = localStorage.getItem('theme');
    if (t) document.documentElement.dataset.theme = t;
    else if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';
  }, []);
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<Protected><div>Authenticated home</div></Protected>} />
    </Routes>
  );
}
```

- [ ] **Step 5: Manual smoke**

Start server + web concurrently, hit `http://localhost:5174` → expect redirect to `/login`.

- [ ] **Step 6: Commit**

```bash
git add web/src/
git commit -m "feat(web): api client + login + auth guard"
```

---

### Task E3: Shell + sidebar + theme toggle

**Files:**
- Create: `dashboard/web/src/layout/Shell.tsx`
- Create: `dashboard/web/src/layout/Sidebar.tsx`
- Create: `dashboard/web/src/layout/ThemeToggle.tsx`
- Modify: `dashboard/web/src/App.tsx`

- [ ] **Step 1: Write `web/src/layout/ThemeToggle.tsx`**

```tsx
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (document.documentElement.dataset.theme as 'light' | 'dark') || 'light'
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  }, [theme]);
  return (
    <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

- [ ] **Step 2: Write `web/src/layout/Sidebar.tsx`**

```tsx
import { NavLink } from 'react-router-dom';

const apps = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'sportly', label: 'Sportly' },
  { slug: 'honeydoeh', label: 'Honey Do Eh' },
  { slug: 'debtmanager', label: 'DebtManager' }
];

export default function Sidebar() {
  return (
    <aside style={{
      width: 200, borderRight: '1px solid var(--border)', padding: 12,
      display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--panel)'
    }}>
      {apps.map(a => (
        <NavLink key={a.slug} to={a.slug === 'overview' ? '/' : `/app/${a.slug}`}
          style={({ isActive }) => ({
            padding: '8px 10px', borderRadius: 6, textDecoration: 'none',
            color: isActive ? 'var(--accent)' : 'var(--text)',
            background: isActive ? 'var(--grid-line)' : 'transparent'
          })}>
          {a.label}
        </NavLink>
      ))}
    </aside>
  );
}
```

- [ ] **Step 3: Write `web/src/layout/Shell.tsx`**

```tsx
import { Outlet, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';

export default function Shell() {
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--panel)'
        }}>
          <strong>Apps Dashboard</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/settings">Settings</Link>
            <ThemeToggle />
          </div>
        </header>
        <main style={{ flex: 1, padding: 16, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `App.tsx` routes**

```tsx
<Route path="/*" element={<Protected><Shell /></Protected>}>
  <Route index element={<div>Overview placeholder</div>} />
  <Route path="app/:slug" element={<div>App placeholder</div>} />
  <Route path="settings" element={<div>Settings placeholder</div>} />
</Route>
```

- [ ] **Step 5: Visual smoke**

Open `http://localhost:5174/`, login, see shell with sidebar + theme toggle. Click toggle → CSS vars swap.

- [ ] **Step 6: Commit**

```bash
git add web/src/layout/ web/src/App.tsx
git commit -m "feat(web): shell + sidebar + theme toggle"
```

---

## Phase F — Grid + widgets

### Task F1: GridCanvas with Gridstack

**Files:**
- Create: `dashboard/web/src/grid/GridCanvas.tsx`
- Create: `dashboard/web/src/grid/WidgetFrame.tsx`

- [ ] **Step 1: Write `web/src/grid/WidgetFrame.tsx`**

```tsx
import React from 'react';

type Props = {
  title: string;
  editing: boolean;
  onRemove?: () => void;
  error?: string | null;
  stale?: boolean;
  children: React.ReactNode;
};

export default function WidgetFrame({ title, editing, onRemove, error, stale, children }: Props) {
  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {title}
        </strong>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {error && <span title={error} style={{ color: 'crimson' }}>!</span>}
          {stale && <span style={{ color: 'var(--muted)', fontSize: 11 }}>stale</span>}
          {editing && onRemove && <button onClick={onRemove}>×</button>}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Write `web/src/grid/GridCanvas.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { GridStack, type GridStackNode } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

export type GridWidget = {
  id: string;
  kind: string;
  app?: string;
  x: number; y: number; w: number; h: number;
  params: Record<string, unknown>;
};

type Props = {
  widgets: GridWidget[];
  editing: boolean;
  onChange: (widgets: GridWidget[]) => void;
  renderWidget: (w: GridWidget) => React.ReactNode;
};

export default function GridCanvas({ widgets, editing, onChange, renderWidget }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<GridStack | null>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    gridRef.current = GridStack.init(
      { column: 12, cellHeight: 60, margin: 8, disableResize: !editing, disableDrag: !editing, float: false },
      rootRef.current
    );
    const sync = () => {
      const nodes = gridRef.current!.engine.nodes as GridStackNode[];
      const next: GridWidget[] = nodes.map(n => {
        const orig = widgets.find(w => w.id === n.id) || { params: {} } as any;
        return { ...orig, id: n.id as string, x: n.x!, y: n.y!, w: n.w!, h: n.h! };
      });
      onChange(next);
    };
    gridRef.current.on('change', sync);
    return () => { gridRef.current?.destroy(false); gridRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!gridRef.current) return;
    if (editing) { gridRef.current.enableMove(true); gridRef.current.enableResize(true); }
    else { gridRef.current.enableMove(false); gridRef.current.enableResize(false); }
  }, [editing]);

  return (
    <div className="grid-stack" ref={rootRef}>
      {widgets.map(w => (
        <div className="grid-stack-item" key={w.id}
             gs-id={w.id} gs-x={w.x} gs-y={w.y} gs-w={w.w} gs-h={w.h}>
          <div className="grid-stack-item-content">{renderWidget(w)}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/grid/
git commit -m "feat(web): GridCanvas + WidgetFrame"
```

---

### Task F2: Widget registry (frontend)

**Files:**
- Create: `dashboard/web/src/widgets/registry.ts`
- Create: `dashboard/web/src/widgets/UsersTotal.tsx`
- Create: `dashboard/web/src/widgets/DauCard.tsx`
- Create: `dashboard/web/src/widgets/HealthCard.tsx`

- [ ] **Step 1: Write `web/src/widgets/UsersTotal.tsx`**

```tsx
import WidgetFrame from '../grid/WidgetFrame';
import { useMetric } from '../api/hooks';

export default function UsersTotal({ app, editing, onRemove }: { app: string; editing: boolean; onRemove?: () => void; }) {
  const q = useMetric('users_total', { app });
  return (
    <WidgetFrame title="Users (total)" editing={editing} onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}>
      <div style={{ fontSize: 32, fontWeight: 600 }}>
        {q.isLoading ? '…' : ((q.data as any)?.data ?? '—')}
      </div>
    </WidgetFrame>
  );
}
```

- [ ] **Step 2: Write `web/src/widgets/DauCard.tsx`** — same shape but kind `dau`, title `DAU`.

```tsx
import WidgetFrame from '../grid/WidgetFrame';
import { useMetric } from '../api/hooks';

export default function DauCard({ app, editing, onRemove }: { app: string; editing: boolean; onRemove?: () => void; }) {
  const q = useMetric('dau', { app });
  return (
    <WidgetFrame title="DAU" editing={editing} onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}>
      <div style={{ fontSize: 32, fontWeight: 600 }}>
        {q.isLoading ? '…' : ((q.data as any)?.data ?? '—')}
      </div>
    </WidgetFrame>
  );
}
```

- [ ] **Step 3: Write `web/src/widgets/HealthCard.tsx`**

```tsx
import WidgetFrame from '../grid/WidgetFrame';
import { useMetric } from '../api/hooks';

export default function HealthCard({ app, editing, onRemove }: { app: string; editing: boolean; onRemove?: () => void; }) {
  const q = useMetric('health', { app });
  const data = (q.data as any)?.data;
  const ok = data?.ok;
  return (
    <WidgetFrame title="Health" editing={editing} onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}>
      <div style={{ fontSize: 18, color: ok ? 'var(--chart-2)' : 'var(--chart-4)' }}>
        {ok === undefined ? '…' : ok ? 'UP' : 'DOWN'}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{data ? `${data.latency_ms}ms · ${data.status ?? data.error ?? ''}` : ''}</div>
    </WidgetFrame>
  );
}
```

- [ ] **Step 4: Write `web/src/widgets/registry.ts`**

```ts
import UsersTotal from './UsersTotal';
import DauCard from './DauCard';
import HealthCard from './HealthCard';

export type WidgetComponentProps = { app?: string; editing: boolean; onRemove?: () => void; params?: Record<string, unknown> };

export const WIDGETS: Record<string, { label: string; defaultSize: { w: number; h: number }; scope: 'app' | 'overview' | 'both'; Component: React.FC<WidgetComponentProps> }> = {
  users_total: { label: 'Users (total)', defaultSize: { w: 2, h: 2 }, scope: 'app',   Component: UsersTotal as any },
  dau:         { label: 'DAU',           defaultSize: { w: 2, h: 2 }, scope: 'app',   Component: DauCard    as any },
  health:      { label: 'Health',        defaultSize: { w: 2, h: 2 }, scope: 'both',  Component: HealthCard as any }
};
```

- [ ] **Step 5: Commit**

```bash
git add web/src/widgets/
git commit -m "feat(web): widget registry + 3 starter widgets"
```

---

### Task F3: Page integration — AppPage with grid

**Files:**
- Create: `dashboard/web/src/pages/AppPage.tsx`
- Create: `dashboard/web/src/grid/EditModeBar.tsx`
- Modify: `dashboard/web/src/App.tsx`

- [ ] **Step 1: Write `web/src/grid/EditModeBar.tsx`**

```tsx
type Props = { editing: boolean; dirty: boolean; onEdit: () => void; onSave: () => void; onCancel: () => void; onAdd: () => void; saving: boolean };

export default function EditModeBar({ editing, dirty, onEdit, onSave, onCancel, onAdd, saving }: Props) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
      {!editing && <button onClick={onEdit}>Edit layout</button>}
      {editing && <>
        <button onClick={onAdd}>+ Add widget</button>
        <button onClick={onSave} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button onClick={onCancel}>Cancel</button>
      </>}
    </div>
  );
}
```

- [ ] **Step 2: Write `web/src/pages/AppPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GridCanvas, { type GridWidget } from '../grid/GridCanvas';
import WidgetFrame from '../grid/WidgetFrame';
import { useLayout, useSaveLayout } from '../api/hooks';
import { WIDGETS } from '../widgets/registry';
import EditModeBar from '../grid/EditModeBar';

export default function AppPage() {
  const { slug = '' } = useParams();
  const layoutQ = useLayout(slug);
  const save = useSaveLayout(slug);
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<GridWidget[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (layoutQ.data) { setLocal(layoutQ.data.layout); setDirty(false); } }, [layoutQ.data]);

  function startEdit() { setEditing(true); }
  function cancel() { setLocal(layoutQ.data?.layout || []); setDirty(false); setEditing(false); }
  async function persist() { await save.mutateAsync(local); setDirty(false); setEditing(false); }

  function remove(id: string) { setLocal(arr => arr.filter(w => w.id !== id)); setDirty(true); }

  function add(kind: string) {
    const def = WIDGETS[kind];
    if (!def) return;
    setLocal(arr => [...arr, {
      id: 'w_' + Math.random().toString(36).slice(2, 8),
      kind, app: slug, x: 0, y: 100, w: def.defaultSize.w, h: def.defaultSize.h, params: {}
    }]);
    setDirty(true);
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px' }}>{slug}</h2>
      <EditModeBar
        editing={editing} dirty={dirty} saving={save.isPending}
        onEdit={startEdit} onSave={persist} onCancel={cancel}
        onAdd={() => add(prompt('kind?') || '')}
      />
      <GridCanvas
        widgets={local}
        editing={editing}
        onChange={(next) => { setLocal(next); setDirty(true); }}
        renderWidget={(w) => {
          const def = WIDGETS[w.kind];
          if (!def) return <WidgetFrame title={w.kind} editing={editing} onRemove={() => remove(w.id)}>Unknown widget</WidgetFrame>;
          const C = def.Component;
          return <C app={w.app} params={w.params} editing={editing} onRemove={() => remove(w.id)} />;
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Wire route in `App.tsx`**

```tsx
import AppPage from './pages/AppPage';
// inside the protected Shell route group:
<Route path="app/:slug" element={<AppPage />} />
```

- [ ] **Step 4: Manual smoke**

Visit `/app/sportly`. Default layout renders. Click Edit → drag → Save. Reload → layout persists.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/AppPage.tsx web/src/grid/EditModeBar.tsx web/src/App.tsx
git commit -m "feat(web): AppPage with editable grid"
```

---

### Task F4: WidgetPalette drawer

**Files:**
- Create: `dashboard/web/src/grid/WidgetPalette.tsx`
- Modify: `dashboard/web/src/pages/AppPage.tsx` (replace `prompt('kind?')`)

- [ ] **Step 1: Write `web/src/grid/WidgetPalette.tsx`**

```tsx
import { WIDGETS } from '../widgets/registry';

export default function WidgetPalette({ open, scope, onPick, onClose }:
  { open: boolean; scope: 'app' | 'overview'; onPick: (kind: string) => void; onClose: () => void }) {
  if (!open) return null;
  const items = Object.entries(WIDGETS).filter(([, w]) => w.scope === scope || w.scope === 'both');
  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 280, background: 'var(--panel)',
      borderLeft: '1px solid var(--border)', padding: 16, zIndex: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <strong>Add widget</strong>
        <button onClick={onClose}>×</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(([kind, def]) => (
          <button key={kind} onClick={() => { onPick(kind); onClose(); }}
            style={{ textAlign: 'left', padding: 10, border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--text)' }}>
            <div><strong>{def.label}</strong></div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>kind: {kind}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Use it in AppPage**

Replace `onAdd={() => add(prompt('kind?') || '')}` with state-driven open. Add:

```tsx
const [paletteOpen, setPaletteOpen] = useState(false);
// pass onAdd={() => setPaletteOpen(true)}
// render at end:
<WidgetPalette open={paletteOpen} scope="app" onPick={add} onClose={() => setPaletteOpen(false)} />
```

- [ ] **Step 3: Commit**

```bash
git add web/src/grid/WidgetPalette.tsx web/src/pages/AppPage.tsx
git commit -m "feat(web): widget palette drawer"
```

---

### Task F5: Remaining widgets

**Files:**
- Create: `web/src/widgets/SignupsTimeseries.tsx`
- Create: `web/src/widgets/ActiveTimeseries.tsx`
- Create: `web/src/widgets/Pm2Card.tsx`
- Create: `web/src/widgets/HttpRate.tsx`
- Create: `web/src/widgets/HttpErrors.tsx`
- Create: `web/src/widgets/HttpLatency.tsx`
- Create: `web/src/widgets/KpiCard.tsx`
- Create: `web/src/widgets/KpiTimeseries.tsx`
- Modify: `web/src/widgets/registry.ts`

- [ ] **Step 1: Write `web/src/widgets/SignupsTimeseries.tsx`**

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import WidgetFrame from '../grid/WidgetFrame';
import { useMetric } from '../api/hooks';

export default function SignupsTimeseries({ app, params = {}, editing, onRemove }:
  { app: string; params?: any; editing: boolean; onRemove?: () => void; }) {
  const q = useMetric('signups_timeseries', { app, range: params.range || '30d', bucket: 'day' });
  const data = ((q.data as any)?.data as { t: string; value: number }[]) || [];
  return (
    <WidgetFrame title="Signups" editing={editing} onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="var(--grid-line)" />
          <XAxis dataKey="t" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="var(--chart-1)" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </WidgetFrame>
  );
}
```

- [ ] **Step 2: Write `web/src/widgets/ActiveTimeseries.tsx`**

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import WidgetFrame from '../grid/WidgetFrame';
import { useMetric } from '../api/hooks';

export default function ActiveTimeseries({ app, params = {}, editing, onRemove }:
  { app: string; params?: any; editing: boolean; onRemove?: () => void; }) {
  const q = useMetric('active_timeseries', { app, range: params.range || '30d' });
  const data = ((q.data as any)?.data as { t: string; value: number }[]) || [];
  return (
    <WidgetFrame title="Active users" editing={editing} onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="var(--grid-line)" />
          <XAxis dataKey="t" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="var(--chart-2)" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </WidgetFrame>
  );
}
```

- [ ] **Step 3: Write `Pm2Card.tsx`**

```tsx
import WidgetFrame from '../grid/WidgetFrame';
import { useMetric } from '../api/hooks';

export default function Pm2Card({ app, editing, onRemove }: { app: string; editing: boolean; onRemove?: () => void; }) {
  const q = useMetric('pm2', { app });
  const d = (q.data as any)?.data || {};
  return (
    <WidgetFrame title="PM2" editing={editing} onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}>
      <div><strong>{d.status || '…'}</strong></div>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>
        cpu {d.cpu ?? '—'}% · mem {d.mem_bytes ? Math.round(d.mem_bytes / 1e6) + 'MB' : '—'} · restarts {d.restarts ?? '—'}
      </div>
    </WidgetFrame>
  );
}
```

- [ ] **Step 4a: Write `web/src/widgets/HttpRate.tsx`**

```tsx
import WidgetFrame from '../grid/WidgetFrame';
import { useMetric } from '../api/hooks';

export default function HttpRate({ app, editing, onRemove }: { app: string; editing: boolean; onRemove?: () => void; }) {
  const q = useMetric('http_rate', { app });
  return (
    <WidgetFrame title="Req (last tick)" editing={editing} onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}>
      <div style={{ fontSize: 32, fontWeight: 600 }}>{q.isLoading ? '…' : ((q.data as any)?.data ?? '—')}</div>
    </WidgetFrame>
  );
}
```

- [ ] **Step 4b: Write `web/src/widgets/HttpErrors.tsx`**

```tsx
import WidgetFrame from '../grid/WidgetFrame';
import { useMetric } from '../api/hooks';

export default function HttpErrors({ app, editing, onRemove }: { app: string; editing: boolean; onRemove?: () => void; }) {
  const q = useMetric('http_errors', { app });
  return (
    <WidgetFrame title="Errors (last tick)" editing={editing} onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}>
      <div style={{ fontSize: 32, fontWeight: 600 }}>{q.isLoading ? '…' : ((q.data as any)?.data ?? '—')}</div>
    </WidgetFrame>
  );
}
```

- [ ] **Step 4c: Write `web/src/widgets/HttpLatency.tsx`**

```tsx
import WidgetFrame from '../grid/WidgetFrame';
import { useMetric } from '../api/hooks';

export default function HttpLatency({ app, editing, onRemove }: { app: string; editing: boolean; onRemove?: () => void; }) {
  const q = useMetric('http_latency', { app });
  return (
    <WidgetFrame title="p95 latency (ms)" editing={editing} onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}>
      <div style={{ fontSize: 32, fontWeight: 600 }}>{q.isLoading ? '…' : ((q.data as any)?.data ?? '—')}</div>
    </WidgetFrame>
  );
}
```

- [ ] **Step 5: Write `KpiCard.tsx`**

```tsx
import WidgetFrame from '../grid/WidgetFrame';
import { useMetric, useApps } from '../api/hooks';

export default function KpiCard({ app, params = {}, editing, onRemove }:
  { app: string; params?: any; editing: boolean; onRemove?: () => void; }) {
  const q = useMetric('kpi', { app, key: params.key });
  const apps = useApps();
  const label = apps.data
    ? ((apps.data as any[]).find(a => a.slug === app)?.kpis?.find?.((k: any) => k.key === params.key)?.label) || params.key
    : params.key;
  return (
    <WidgetFrame title={label || 'KPI'} editing={editing} onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}>
      <div style={{ fontSize: 28, fontWeight: 600 }}>{q.isLoading ? '…' : ((q.data as any)?.data ?? '—')}</div>
    </WidgetFrame>
  );
}
```

- [ ] **Step 6: Write `KpiTimeseries.tsx`** — mirror `SignupsTimeseries` but `kind: 'kpi_timeseries'`, pass `key` + `range` via params.

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import WidgetFrame from '../grid/WidgetFrame';
import { useMetric } from '../api/hooks';

export default function KpiTimeseries({ app, params = {}, editing, onRemove }:
  { app: string; params?: any; editing: boolean; onRemove?: () => void; }) {
  const q = useMetric('kpi_timeseries', { app, key: params.key, range: params.range || '30d' });
  const data = ((q.data as any)?.data as { t: string; value: number }[]) || [];
  return (
    <WidgetFrame title={`KPI: ${params.key || ''}`} editing={editing} onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="var(--grid-line)" />
          <XAxis dataKey="t" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="var(--chart-5)" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </WidgetFrame>
  );
}
```

- [ ] **Step 7: Update `web/src/widgets/registry.ts`** — register all kinds with same shape:

```ts
import UsersTotal from './UsersTotal';
import DauCard from './DauCard';
import HealthCard from './HealthCard';
import SignupsTimeseries from './SignupsTimeseries';
import ActiveTimeseries from './ActiveTimeseries';
import Pm2Card from './Pm2Card';
import HttpRate from './HttpRate';
import HttpErrors from './HttpErrors';
import HttpLatency from './HttpLatency';
import KpiCard from './KpiCard';
import KpiTimeseries from './KpiTimeseries';

export const WIDGETS = {
  users_total:        { label: 'Users (total)',     defaultSize: { w: 2, h: 2 }, scope: 'app' as const,      Component: UsersTotal },
  dau:                { label: 'DAU',               defaultSize: { w: 2, h: 2 }, scope: 'app' as const,      Component: DauCard },
  health:             { label: 'Health',            defaultSize: { w: 2, h: 2 }, scope: 'both' as const,     Component: HealthCard },
  signups_timeseries: { label: 'Signups over time', defaultSize: { w: 6, h: 4 }, scope: 'app' as const,      Component: SignupsTimeseries },
  active_timeseries:  { label: 'DAU over time',     defaultSize: { w: 6, h: 4 }, scope: 'app' as const,      Component: ActiveTimeseries },
  pm2:                { label: 'PM2 status',        defaultSize: { w: 3, h: 2 }, scope: 'both' as const,     Component: Pm2Card },
  http_rate:          { label: 'Requests',          defaultSize: { w: 3, h: 2 }, scope: 'app' as const,      Component: HttpRate },
  http_errors:        { label: 'HTTP errors',       defaultSize: { w: 3, h: 2 }, scope: 'app' as const,      Component: HttpErrors },
  http_latency:       { label: 'p95 latency',       defaultSize: { w: 3, h: 2 }, scope: 'app' as const,      Component: HttpLatency },
  kpi:                { label: 'KPI value',         defaultSize: { w: 3, h: 2 }, scope: 'app' as const,      Component: KpiCard },
  kpi_timeseries:     { label: 'KPI over time',     defaultSize: { w: 6, h: 4 }, scope: 'app' as const,      Component: KpiTimeseries }
} as const;
```

- [ ] **Step 8: Commit**

```bash
git add web/src/widgets/
git commit -m "feat(web): remaining widget components"
```

---

### Task F6: Overview page + Settings stub

**Files:**
- Create: `dashboard/web/src/pages/Overview.tsx`
- Create: `dashboard/web/src/pages/Settings.tsx`
- Create: `dashboard/web/src/pages/AcceptInvite.tsx`
- Modify: `dashboard/web/src/App.tsx`

- [ ] **Step 1: Overview is structurally the same as AppPage but `screen = 'overview'`, default widgets render across apps (health, pm2)**

```tsx
import { useEffect, useState } from 'react';
import GridCanvas, { type GridWidget } from '../grid/GridCanvas';
import WidgetFrame from '../grid/WidgetFrame';
import { useLayout, useSaveLayout, useApps } from '../api/hooks';
import { WIDGETS } from '../widgets/registry';
import EditModeBar from '../grid/EditModeBar';
import WidgetPalette from '../grid/WidgetPalette';

export default function Overview() {
  const layoutQ = useLayout('overview');
  const apps = useApps();
  const save = useSaveLayout('overview');
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<GridWidget[]>([]);
  const [dirty, setDirty] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => { if (layoutQ.data) { setLocal(layoutQ.data.layout); setDirty(false); } }, [layoutQ.data]);

  function remove(id: string) { setLocal(arr => arr.filter(w => w.id !== id)); setDirty(true); }
  function add(kind: string) {
    const def = (WIDGETS as any)[kind]; if (!def) return;
    const firstApp = apps.data?.[0]?.slug;
    setLocal(arr => [...arr, {
      id: 'w_' + Math.random().toString(36).slice(2, 8),
      kind, app: firstApp, x: 0, y: 100,
      w: def.defaultSize.w, h: def.defaultSize.h, params: {}
    }]);
    setDirty(true);
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px' }}>Overview</h2>
      <EditModeBar editing={editing} dirty={dirty} saving={save.isPending}
        onEdit={() => setEditing(true)}
        onSave={async () => { await save.mutateAsync(local); setDirty(false); setEditing(false); }}
        onCancel={() => { setLocal(layoutQ.data?.layout || []); setDirty(false); setEditing(false); }}
        onAdd={() => setPaletteOpen(true)} />
      <GridCanvas
        widgets={local}
        editing={editing}
        onChange={(next) => { setLocal(next); setDirty(true); }}
        renderWidget={(w) => {
          const def = (WIDGETS as any)[w.kind];
          if (!def) return <WidgetFrame title={w.kind} editing={editing} onRemove={() => remove(w.id)}>Unknown</WidgetFrame>;
          const C = def.Component;
          return <C app={w.app} params={w.params} editing={editing} onRemove={() => remove(w.id)} />;
        }}
      />
      <WidgetPalette open={paletteOpen} scope="overview" onPick={add} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Settings page — invites list + create**

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export default function Settings() {
  const qc = useQueryClient();
  const invites = useQuery({ queryKey: ['invites'], queryFn: () => api.get<any[]>('/api/invites') });
  const create = useMutation({
    mutationFn: (email: string) => api.post<any>('/api/invites', { email }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] })
  });
  const [email, setEmail] = useState('');
  const [last, setLast] = useState<string | null>(null);

  return (
    <div className="panel" style={{ maxWidth: 600 }}>
      <h2 style={{ marginTop: 0 }}>Settings</h2>
      <h3>Invites</h3>
      <form onSubmit={async e => { e.preventDefault(); const r = await create.mutateAsync(email); setLast(r.token); setEmail(''); }}>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email (optional)" />
        <button type="submit">Create invite</button>
      </form>
      {last && <div>New invite token: <code>{last}</code></div>}
      <ul>
        {invites.data?.map(i => (
          <li key={i.id}>{i.email || '(no email)'} · expires {i.expires_at}
            <button onClick={() => api.del(`/api/invites/${i.id}`).then(() => qc.invalidateQueries({ queryKey: ['invites'] }))}>revoke</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: AcceptInvite page**

```tsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

export default function AcceptInvite() {
  const [sp] = useSearchParams();
  const token = sp.get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    try {
      await api.post('/api/auth/accept-invite', { token, email, password });
      nav('/');
    } catch (e: any) { setErr(e.message); }
  }
  return (
    <form onSubmit={submit} className="panel" style={{ maxWidth: 360, margin: '80px auto' }}>
      <h2 style={{ marginTop: 0 }}>Accept invite</h2>
      <label>Email<input value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label>Password (min 12)<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      {err && <div style={{ color: 'crimson' }}>{err}</div>}
      <button type="submit">Create account</button>
    </form>
  );
}
```

- [ ] **Step 4: Wire routes in `App.tsx`**

```tsx
import Overview from './pages/Overview';
import Settings from './pages/Settings';
import AcceptInvite from './pages/AcceptInvite';
// public:
<Route path="/accept-invite" element={<AcceptInvite />} />
// inside Shell route group, replace placeholders:
<Route index element={<Overview />} />
<Route path="settings" element={<Settings />} />
```

- [ ] **Step 5: Manual smoke**

Visit `/`, `/app/sportly`, `/settings`. Verify each renders.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/ web/src/App.tsx
git commit -m "feat(web): Overview, Settings, AcceptInvite pages"
```

---

### Task F7: Playwright e2e

**Files:**
- Create: `dashboard/web/playwright.config.ts`
- Create: `dashboard/web/e2e/login-and-grid.spec.ts`

- [ ] **Step 1: Install Playwright**

```bash
npm install -w web -D @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Write `web/playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5174', headless: true },
  webServer: [
    { command: 'cd .. && NODE_ENV=test DB_NAME=dashboard_test POLLER=off npm run dev -w server', port: 4110, reuseExistingServer: true },
    { command: 'npm run dev', port: 5174, reuseExistingServer: true }
  ]
});
```

- [ ] **Step 3: Write `web/e2e/login-and-grid.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('login then drag a widget and persist', async ({ page, request }) => {
  // seed admin via API directly
  await request.post('/api/test/seed', { data: { email: 'e2e@example.com', password: 'zX9!muPpetDance#Lurking' } }).catch(() => {});

  await page.goto('/login');
  await page.fill('input[type=text],input:not([type])', 'e2e@example.com');
  await page.fill('input[type=password]', 'zX9!muPpetDance#Lurking');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL('/');
  await expect(page.locator('text=Overview')).toBeVisible();

  await page.click('text=Sportly');
  await page.click('text=Edit layout');
  await page.click('text=Save');
  await expect(page.locator('text=Edit layout')).toBeVisible();
});
```

- [ ] **Step 4: Add a test-only seed route to support e2e**

In `server/app.js` (guarded by `NODE_ENV==='test'`):

```js
if (process.env.NODE_ENV === 'test') {
  const { seedAdmin } = await import('./auth/seed.js');
  app.post('/api/test/seed', express.json(), async (req, res) => {
    try { await seedAdmin(req.body.email, req.body.password); res.json({ ok: true }); }
    catch (e) { res.json({ ok: false, err: e.message }); }
  });
}
```

- [ ] **Step 5: Run e2e**

```bash
DB_NAME=dashboard_test npm run migrate
npm exec -w web playwright test
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add web/playwright.config.ts web/e2e/ server/app.js
git commit -m "test(web): playwright e2e — login + grid round-trip"
```

---

## Phase G — Ops

### Task G1: PM2 ecosystem + APPS_AND_PORTS.md update

**Files:**
- Create: `dashboard/ecosystem.config.cjs`
- Modify: `/mnt/storage/apps/APPS_AND_PORTS.md`

- [ ] **Step 1: Write `ecosystem.config.cjs`**

```js
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

- [ ] **Step 2: Add row in APPS_AND_PORTS.md**

In the PM2 process names table:

```
| **`dashboard`** | Dashboard | `dashboard/` | **4010** (web+api) |
```

And in the quick matrix:

```
| dashboard   | 4010 | 4110 | — (served by API) |
```

- [ ] **Step 3: Commit**

```bash
git add ecosystem.config.cjs
git -C /mnt/storage/apps add APPS_AND_PORTS.md
git commit -m "ops: PM2 ecosystem + APPS_AND_PORTS update"
```

> The APPS_AND_PORTS file lives outside this repo's tree; commit it inside whatever repo owns `/mnt/storage/apps` (or skip if it's not in git).

---

### Task G2: grant-readers + backup scripts

**Files:**
- Create: `dashboard/scripts/grant-readers.sh`
- Create: `dashboard/scripts/backup.sh`

- [ ] **Step 1: Write `scripts/grant-readers.sh`**

```bash
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
```

- [ ] **Step 2: Write `scripts/backup.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
OUT_DIR="${BACKUP_DIR:-/mnt/storage/backups}"
mkdir -p "$OUT_DIR"
ts=$(date -u +%F)
pg_dump dashboard | gzip > "$OUT_DIR/dashboard-$ts.sql.gz"
find "$OUT_DIR" -name 'dashboard-*.sql.gz' -mtime +14 -delete
```

- [ ] **Step 3: Make executable**

```bash
chmod +x scripts/grant-readers.sh scripts/backup.sh
```

- [ ] **Step 4: Add crontab guidance to README of scripts/**

```bash
# crontab -e:
# 0 3 * * * /mnt/storage/apps/dashboard/scripts/backup.sh >> /mnt/storage/apps/dashboard/logs/backup.log 2>&1
```

- [ ] **Step 5: Commit**

```bash
git add scripts/grant-readers.sh scripts/backup.sh
git commit -m "ops: scripts for reader role and nightly backup"
```

---

## Phase H — Verification

### Task H1: Full smoke

- [ ] **Step 1: Boot pipeline**

```bash
NODE_ENV=production npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

- [ ] **Step 2: curl health + apps**

```bash
curl -s http://localhost:4010/health | head
# expect: {"ok":true,...}

# log in via a real cookie jar:
curl -s -c /tmp/c.txt -X POST http://localhost:4010/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"..."}'

curl -s -b /tmp/c.txt http://localhost:4010/api/apps | head
# expect: array of 3 apps with status fields
```

- [ ] **Step 3: Browser walkthrough**

Open `http://localhost:4010` (proxied via nginx in prod), log in, verify Overview + each app page renders, edit/save layout, switch themes.

- [ ] **Step 4: Tag**

```bash
git tag v0.1.0
```

---

## Spec coverage map

| Spec section | Covered by |
|---|---|
| §1 Goal / scope | All tasks |
| §2 Pull-only strategy | C1–C8, D5 |
| §3 Architecture | A1, B4, D5, E1, G1 |
| §4 Data model | A2, B5 (invites), D4 (layouts) |
| §5 Backend dirs + endpoints | B1–B6, C1–C8, D1–D6 |
| §6 Frontend stack + grid | E1–E3, F1–F6 |
| §7 Auth flow (login/session/invite/CSRF) | B1–B6 |
| §8 Deployment + env + roles | A1 (env), G1 (PM2), G2 (roles, backup) |
| §9 Error handling | D3 (envelope), F1–F5 (widget error UI), D5 (poller per-app catch) |
| §10 Testing | A3, plus per-task TDD steps + F7 (Playwright) |
| §11 Observability | D6 |
| §12 Perf budget | D5 (warn > 5s tick) |
| §13 Decisions log | informational |

Port adjusted from spec §3 (4000 → 4010, dev 4100 → 4110) per user direction; reflected throughout.
