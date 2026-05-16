import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { total, timeseries } from './pgUsers.js';

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

describe('pgUsers', () => {
  it('returns total user count', async () => {
    const v = await total(pool);
    expect(v).toBe(5);
  });

  it('returns daily timeseries with zero-filled days', async () => {
    const series = await timeseries(pool, { range: '7d' });
    expect(series).toHaveLength(7);
    expect(series.every(p => typeof p.t === 'string' && typeof p.value === 'number')).toBe(true);
    const sum = series.reduce((a, p) => a + p.value, 0);
    expect(sum).toBeGreaterThanOrEqual(2);
  });
});
