import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

const { dbPool } = await import('../db.js');

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
