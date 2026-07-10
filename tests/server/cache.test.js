import { describe, it, expect, beforeEach } from 'vitest';
import { Cache } from '@server/cache.js';

describe('Cache', () => {
  let c;
  beforeEach(() => { c = new Cache({ max: 3 }); });

  it('returns undefined on miss', () => {
    expect(c.get('x')).toBeUndefined();
  });

  it('stores and retrieves within TTL', () => {
    c.set('x', 1, 1000);
    expect(c.get('x')).toBe(1);
  });

  it('expires after TTL', async () => {
    c.set('x', 1, 5);
    await new Promise(r => setTimeout(r, 20));
    expect(c.get('x')).toBeUndefined();
  });

  it('evicts least-recently-set when over max', () => {
    c.set('a', 1, 1000);
    c.set('b', 2, 1000);
    c.set('c', 3, 1000);
    c.set('d', 4, 1000);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('d')).toBe(4);
  });
});
