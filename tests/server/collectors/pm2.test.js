import { describe, it, expect } from 'vitest';
import { parseJlist } from '@server/collectors/pm2.js';

describe('pm2.parseJlist', () => {
  it('parses jlist output', () => {
    const json = JSON.stringify([
      { name: 'sportly-backend', pm2_env: { status: 'online', restart_time: 2 }, monit: { cpu: 4, memory: 80_000_000 } },
      { name: 'honeydoeh-api',  pm2_env: { status: 'stopped', restart_time: 0 }, monit: { cpu: 0, memory: 0 } }
    ]);
    const out = parseJlist(json);
    expect(out['sportly-backend']).toEqual({ status: 'online', restarts: 2, cpu: 4, mem_bytes: 80_000_000 });
    expect(out['honeydoeh-api'].status).toBe('stopped');
  });

  it('returns empty object for empty list', () => {
    expect(parseJlist('[]')).toEqual({});
  });
});
