import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkHealth } from '@server/collectors/health.js';

afterEach(() => vi.restoreAllMocks());

describe('checkHealth', () => {
  it('returns ok=true on 2xx', async () => {
    global.fetch = vi.fn(async () => new Response('', { status: 200 }));
    const r = await checkHealth('http://x/health');
    expect(r.ok).toBe(true);
    expect(typeof r.latency_ms).toBe('number');
  });

  it('returns ok=false on non-2xx', async () => {
    global.fetch = vi.fn(async () => new Response('', { status: 503 }));
    const r = await checkHealth('http://x/health');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(503);
  });

  it('returns ok=false on error', async () => {
    global.fetch = vi.fn(async () => { throw new Error('econnrefused'); });
    const r = await checkHealth('http://x/health');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/econnrefused/);
  });
});
