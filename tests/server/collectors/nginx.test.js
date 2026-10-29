import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLine, readNew, summarize } from '@server/collectors/nginx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(__dirname, '../../fixtures/nginx-sample.log');

describe('nginx collector', () => {
  it('parses time, status and request_time', () => {
    const e = parseLine('1.2.3.4 - - [16/May/2026:12:00:02 -0300] "GET /x HTTP/1.1" 500 32 "-" "ua" 0.300');
    expect(e).toEqual({ ts: Date.UTC(2026, 4, 16, 15, 0, 2), status: 500, ms: 300 });
  });

  it('rejects the default combined format (no request_time)', () => {
    expect(parseLine('1.2.3.4 - - [16/May/2026:12:00:02 +0000] "GET / HTTP/1.1" 200 32 "-" "ua"')).toBeNull();
  });

  it('reads every line from offset 0', async () => {
    const r = await readNew(fixture, { fromOffset: 0 });
    expect(r.entries).toHaveLength(5);
    expect(r.unmatched).toBe(0);
    expect(r.nextOffset).toBeGreaterThan(0);
  });

  it('reads nothing new from the end offset', async () => {
    const first = await readNew(fixture, { fromOffset: 0 });
    const second = await readNew(fixture, { fromOffset: first.nextOffset });
    expect(second.entries).toHaveLength(0);
  });

  it('a backfill read drops the partial first line', async () => {
    const r = await readNew(fixture, { backfillBytes: 120 });
    expect(r.entries.length).toBeGreaterThan(0);
    expect(r.entries.length).toBeLessThan(5);
    expect(r.unmatched).toBe(0);
  });

  it('counts unparseable lines', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nginx-'));
    const file = path.join(dir, 'combined.log');
    await fs.writeFile(file, '127.0.0.1 - - [16/May/2026:12:00:00 +0000] "GET / HTTP/1.1" 200 32 "-" "ua"\n');
    const r = await readNew(file, { fromOffset: 0 });
    expect(r.entries).toHaveLength(0);
    expect(r.unmatched).toBe(1);
    await fs.rm(dir, { recursive: true });
  });

  it('returns log_unreadable for a missing file', async () => {
    const r = await readNew('/nonexistent.log', { fromOffset: 0 });
    expect(r.error).toBe('log_unreadable');
  });

  it('summarize only counts entries inside the window', () => {
    const now = 1_000_000_000;
    const s = summarize(
      [
        { ts: now - 1000, status: 200, ms: 10 },
        { ts: now - 2000, status: 503, ms: 50 },
        { ts: now - 3000, status: 404, ms: 20 },
        { ts: now - 999_999, status: 500, ms: 99 },
      ],
      10_000,
      now,
    );
    expect(s).toEqual({ count: 3, errors_4xx: 1, errors_5xx: 1, p95_ms: 50 });
  });
});
