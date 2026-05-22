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
