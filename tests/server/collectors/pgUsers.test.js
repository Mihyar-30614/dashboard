import { describe, it, expect } from 'vitest';
import { total, timeseries } from '@server/collectors/pgUsers.js';

function fakePool(rowsByQuery) {
  return {
    query: async (sql) => {
      const match = Object.entries(rowsByQuery).find(([k]) => sql.includes(k));
      return { rows: match ? match[1] : [] };
    },
  };
}

describe('pgUsers', () => {
  it('returns total user count', async () => {
    const pool = fakePool({ 'COUNT(*)': [{ value: 5 }] });
    const v = await total(pool);
    expect(v).toBe(5);
  });

  it('returns daily timeseries with zero-filled days', async () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      t: `2026-05-${String(i + 1).padStart(2, '0')}`,
      value: i < 2 ? 1 : 0,
    }));
    const pool = fakePool({ 'generate_series': rows });
    const series = await timeseries(pool, { range: '7d' });
    expect(series).toHaveLength(7);
    expect(series.every(p => typeof p.t === 'string' && typeof p.value === 'number')).toBe(true);
    const sum = series.reduce((a, p) => a + p.value, 0);
    expect(sum).toBeGreaterThanOrEqual(2);
  });
});
