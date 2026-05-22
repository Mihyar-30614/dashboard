import { describe, it, expect, vi } from 'vitest';
import { rewriteSql, RANGE_DAYS, executeSqlWidget, inferViz } from './sqlWidgets.js';

function fakePool({ rows = [], fields = [], throwOn = null } = {}) {
  const queries = [];
  const client = {
    query: vi.fn(async (text) => {
      queries.push(text);
      if (throwOn && text === throwOn) throw new Error('boom');
      if (text === 'SET statement_timeout = 5000') return { rows: [] };
      if (text === 'SET default_transaction_read_only = on') return { rows: [] };
      if (text === 'BEGIN READ ONLY') return { rows: [] };
      if (text === 'ROLLBACK') return { rows: [] };
      return { rows, fields };
    }),
    release: vi.fn(),
  };
  return { connect: vi.fn(async () => client), _client: client, _queries: queries };
}

describe('rewriteSql', () => {
  it('substitutes :range_days with $1', () => {
    const { text, days } = rewriteSql('SELECT * WHERE n > :range_days', '7d');
    expect(text).toBe('SELECT * WHERE n > $1');
    expect(days).toBe(7);
  });

  it('substitutes every occurrence', () => {
    const { text } = rewriteSql('SELECT :range_days, :range_days', '30d');
    expect(text).toBe('SELECT $1, $1');
  });

  it('defaults unknown range to 30', () => {
    const { days } = rewriteSql('SELECT 1', 'bogus');
    expect(days).toBe(30);
  });

  it('throws on multi-statement SQL', () => {
    expect(() => rewriteSql('SELECT 1; SELECT 2', '7d'))
      .toThrow('bad_sql');
  });

  it('allows trailing semicolon', () => {
    const { text } = rewriteSql('SELECT 1;', '7d');
    expect(text).toBe('SELECT 1;');
  });

  it('throws on oversized SQL', () => {
    expect(() => rewriteSql('SELECT 1 -- ' + 'x'.repeat(20_000), '7d'))
      .toThrow('sql_too_large');
  });

  it('throws on unknown :param tokens', () => {
    expect(() => rewriteSql('SELECT :foo', '7d'))
      .toThrow('unknown_param:foo');
  });

  it('RANGE_DAYS maps known values', () => {
    expect(RANGE_DAYS).toEqual({ '7d': 7, '30d': 30, '90d': 90 });
  });
});

describe('executeSqlWidget', () => {
  it('sets timeout, opens read-only txn, runs sql, rolls back', async () => {
    const pool = fakePool({
      rows: [{ value: 7 }],
      fields: [{ name: 'value' }],
    });
    const out = await executeSqlWidget(pool, 'SELECT :range_days', '7d');
    expect(pool._queries).toEqual([
      'SET statement_timeout = 5000',
      'SET default_transaction_read_only = on',
      'BEGIN READ ONLY',
      'SELECT $1',
      'ROLLBACK',
    ]);
    expect(out.columns).toEqual(['value']);
    expect(out.rows).toEqual([{ value: 7 }]);
    expect(out.truncated).toBe(false);
    expect(pool._client.release).toHaveBeenCalled();
  });

  it('caps rows at MAX_ROWS and sets truncated', async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({ n: i }));
    const pool = fakePool({ rows, fields: [{ name: 'n' }] });
    const out = await executeSqlWidget(pool, 'SELECT n FROM t', '7d');
    expect(out.rows).toHaveLength(1000);
    expect(out.truncated).toBe(true);
  });

  it('rolls back and releases on query error', async () => {
    const pool = fakePool({ throwOn: 'SELECT $1', rows: [], fields: [] });
    await expect(executeSqlWidget(pool, 'SELECT :range_days', '7d'))
      .rejects.toThrow();
    expect(pool._queries).toContain('ROLLBACK');
    expect(pool._client.release).toHaveBeenCalled();
  });

  it('returns durationMs as a number', async () => {
    const pool = fakePool({ rows: [], fields: [] });
    const out = await executeSqlWidget(pool, 'SELECT 1', '7d');
    expect(typeof out.durationMs).toBe('number');
    expect(out.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('inferViz', () => {
  it('returns number for 1 row × 1 numeric column', () => {
    expect(inferViz({ columns: ['v'], rows: [{ v: 42 }] })).toBe('number');
  });
  it('returns line for t + numeric columns', () => {
    expect(inferViz({
      columns: ['t', 'value'],
      rows: [{ t: '2026-05-01', value: 1 }, { t: '2026-05-02', value: 2 }]
    })).toBe('line');
  });
  it('returns bar for text + numeric', () => {
    expect(inferViz({
      columns: ['label', 'count'],
      rows: [{ label: 'a', count: 1 }, { label: 'b', count: 2 }]
    })).toBe('bar');
  });
  it('returns table otherwise', () => {
    expect(inferViz({
      columns: ['a', 'b', 'c'],
      rows: [{ a: 1, b: 2, c: 3 }, { a: 4, b: 5, c: 6 }]
    })).toBe('table');
  });
  it('returns table for empty result', () => {
    expect(inferViz({ columns: [], rows: [] })).toBe('table');
  });
});
