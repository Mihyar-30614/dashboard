import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregate } from './nginx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(__dirname, '../test/fixtures/nginx-sample.log');

describe('nginx aggregate', () => {
  it('counts requests, errors, p95 from a sample log', async () => {
    const agg = await aggregate(fixture, { fromOffset: 0 });
    expect(agg.count).toBe(5);
    expect(agg.errors).toBe(2);
    expect(agg.errors_5xx).toBe(1);
    expect(agg.p95_ms).toBeGreaterThan(0);
    expect(agg.nextOffset).toBeGreaterThan(0);
  });

  it('skips lines before fromOffset', async () => {
    const first = await aggregate(fixture, { fromOffset: 0 });
    const second = await aggregate(fixture, { fromOffset: first.nextOffset });
    expect(second.count).toBe(0);
  });

  it('returns log_unreadable for missing file', async () => {
    const r = await aggregate('/nonexistent.log', { fromOffset: 0 });
    expect(r.error).toBe('log_unreadable');
  });
});
