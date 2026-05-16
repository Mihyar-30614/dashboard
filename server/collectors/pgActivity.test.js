import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { dau, timeseries } from './pgActivity.js';

const APP_CFG = {
  queries: {
    dau: "SELECT COUNT(DISTINCT user_id)::int AS value FROM refresh_tokens WHERE last_used_at > NOW() - INTERVAL '1 day'",
    active_timeseries: "WITH days AS (SELECT generate_series(date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day', date_trunc('day', NOW()), INTERVAL '1 day') AS d) SELECT to_char(days.d, 'YYYY-MM-DD') AS t, COUNT(DISTINCT rt.user_id)::int AS value FROM days LEFT JOIN refresh_tokens rt ON rt.last_used_at >= days.d AND rt.last_used_at < days.d + INTERVAL '1 day' GROUP BY days.d ORDER BY days.d"
  }
};

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
  it('throws when not configured', async () => {
    await expect(dau(pool)).rejects.toThrow('dau_not_configured');
  });

  it('runs the per-app DAU SQL when configured', async () => {
    const n = await dau(pool, APP_CFG);
    expect(typeof n).toBe('number');
  });

  it('runs the per-app timeseries SQL when configured', async () => {
    const s = await timeseries(pool, { range: '7d' }, APP_CFG);
    expect(s).toHaveLength(7);
  });
});
