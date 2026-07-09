import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { runKpi } from './pgKpi.js';

let pool;
beforeAll(() => {
  pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'dashboard_test'
  });
});
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
  }, 15000);
});
