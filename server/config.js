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
