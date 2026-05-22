import { describe, it, expect } from 'vitest';
import { rewriteSql, RANGE_DAYS } from './sqlWidgets.js';

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
