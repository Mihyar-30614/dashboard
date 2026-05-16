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
