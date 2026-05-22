import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.resolve(__dirname, '../config/data_sources.json');

const pools = new Map();

export function _resetForTests() {
  pools.clear();
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
