import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { dau, wau, mau, timeseries } from './pgActivity.js';

let pool;
beforeAll(() => {
  pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'sportly_fixture'
  });
});
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
