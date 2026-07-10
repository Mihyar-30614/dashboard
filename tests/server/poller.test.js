import { describe, it, expect, vi } from 'vitest';
import { runTick } from '@server/poller.js';
import * as appPools from '@server/appPools.js';
import * as pgUsers from '@server/collectors/pgUsers.js';
import * as pgActivity from '@server/collectors/pgActivity.js';
import * as pm2 from '@server/collectors/pm2.js';
import * as health from '@server/collectors/health.js';
import { dbPool } from '@server/db.js';

describe('poller.runTick', () => {
  it('writes metric_samples for users_total, dau, and kpis', async () => {
    process.env.DASHBOARD_READER_PASSWORD = '';
    vi.spyOn(appPools, 'getAppPool').mockReturnValue({ query: vi.fn().mockResolvedValue({ rows: [{ value: 1 }] }) });
    vi.spyOn(pgUsers, 'total').mockResolvedValue(10);
    vi.spyOn(pgActivity, 'dau').mockResolvedValue(3);
    vi.spyOn(pm2, 'snapshot').mockResolvedValue({});
    vi.spyOn(health, 'checkHealth').mockResolvedValue({ ok: true, status: 200, latency_ms: 5 });

    await runTick();
    const { rows } = await dbPool.query(
      "SELECT metric, COUNT(*)::int n FROM metric_samples GROUP BY metric ORDER BY metric"
    );
    const map = Object.fromEntries(rows.map(r => [r.metric, r.n]));
    expect(map.users_total).toBe(3);
    expect(map.dau).toBe(3);
  });
});
