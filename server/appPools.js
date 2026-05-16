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
