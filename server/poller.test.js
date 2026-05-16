import { describe, it, expect, vi } from 'vitest';
import { runTick } from './poller.js';
import * as appPools from './appPools.js';
import * as pgUsers from './collectors/pgUsers.js';
import * as pgActivity from './collectors/pgActivity.js';
import * as pm2 from './collectors/pm2.js';
import * as health from './collectors/health.js';
import { dbPool } from './db.js';

describe('poller.runTick', () => {
  it('writes metric_samples for users_total, dau, and kpis', async () => {
    process.env.APP_DB_PASSWORDS_JSON = JSON.stringify({ sportly: '', honeydoeh: '', debtmanager: '' });
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
