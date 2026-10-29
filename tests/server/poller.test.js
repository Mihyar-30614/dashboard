import { describe, it, expect, vi } from 'vitest';
import { runTick } from '@server/poller.js';
import * as pm2 from '@server/collectors/pm2.js';
import * as health from '@server/collectors/health.js';
import { dbPool } from '@server/db.js';

describe('poller.runTick', () => {
  it('writes a health_ok sample per app', async () => {
    process.env.DASHBOARD_READER_PASSWORD = '';
    vi.spyOn(pm2, 'snapshot').mockResolvedValue({});
    vi.spyOn(health, 'checkHealth').mockResolvedValue({ ok: true, status: 200, latency_ms: 5 });

    await runTick();
    const { rows } = await dbPool.query(
      "SELECT metric, COUNT(*)::int n FROM metric_samples GROUP BY metric ORDER BY metric"
    );
    const map = Object.fromEntries(rows.map(r => [r.metric, r.n]));
    expect(map).toEqual({ health_ok: 3 });
  });
});
