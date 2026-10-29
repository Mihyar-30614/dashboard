import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '@server/app.js';
import { seedAdmin } from '@server/auth/seed.js';
import * as pm2 from '@server/collectors/pm2.js';
import * as health from '@server/collectors/health.js';
import * as nginx from '@server/collectors/nginx.js';
import * as dm from '@server/insights/debtmanager.js';
import { _resetForTests } from '@server/routes/metrics.js';

let app, agent;
beforeEach(async () => {
  _resetForTests();
  process.env.DASHBOARD_READER_PASSWORD = 'x';
  await seedAdmin('admin@example.com', 'zX9!muPpetDance#Lurking');
  vi.spyOn(pm2, 'snapshot').mockResolvedValue({
    'sportly-backend': { status: 'online', cpu: 1, mem_bytes: 100, restarts: 0 }
  });
  vi.spyOn(health, 'checkHealth').mockResolvedValue({ ok: true, status: 200, latency_ms: 5 });
  const now = Date.now();
  vi.spyOn(nginx, 'readNew').mockResolvedValue({
    entries: [
      { ts: now - 60_000, status: 200, ms: 40 },
      { ts: now - 120_000, status: 500, ms: 900 },
      { ts: now - 30 * 60_000, status: 404, ms: 10 },
      { ts: now - 2 * 60 * 60_000, status: 500, ms: 10 },
    ],
    unmatched: 0,
    nextOffset: 1024,
  });
  app = buildApp();
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({
    email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking'
  });
});

describe('GET /api/metrics/:kind', () => {
  it('401 without login', async () => {
    const res = await request(app).get('/api/metrics/health?app=sportly');
    expect(res.status).toBe(401);
  });

  it('unknown kind returns 400', async () => {
    const res = await agent.get('/api/metrics/bogus?app=sportly');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unknown_kind');
  });

  it('unknown app returns 400', async () => {
    const res = await agent.get('/api/metrics/health?app=nope');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unknown_app');
  });

  it('health uses configured url', async () => {
    const res = await agent.get('/api/metrics/health?app=sportly');
    expect(res.body.data.ok).toBe(true);
    expect(health.checkHealth).toHaveBeenCalledWith('http://localhost:4003/health');
  });

  it('pm2 returns app entry or unknown', async () => {
    const res = await agent.get('/api/metrics/pm2?app=sportly');
    expect(res.body.data.status).toBe('online');
    const missing = await agent.get('/api/metrics/pm2?app=honeydoeh');
    expect(missing.body.data.status).toBe('unknown');
  });

  it('traffic summarises the rolling nginx window', async () => {
    const res = await agent.get('/api/metrics/traffic?app=sportly');
    expect(res.body.data.last_5m.count).toBe(2);
    expect(res.body.data.last_hour).toMatchObject({ count: 3, errors_5xx: 1, errors_4xx: 1 });
    expect(res.body.data.per_min).toBe(0.4);
  });

  it('traffic surfaces the collector error instead of a 0', async () => {
    nginx.readNew.mockResolvedValueOnce({ entries: [], unmatched: 0, nextOffset: null, error: 'log_unreadable' });
    const res = await agent.get('/api/metrics/traffic?app=honeydoeh');
    expect(res.body).toEqual({ error: 'log_unreadable' });
  });

  it('app_status keeps working when one signal fails', async () => {
    nginx.readNew.mockResolvedValueOnce({ entries: [], unmatched: 0, nextOffset: null, error: 'log_unreadable' });
    vi.spyOn(dm, 'jobs').mockResolvedValue({ label: 'last reminder email', last_at: null, attention: 0 });
    const res = await agent.get('/api/metrics/app_status?app=debtmanager');
    expect(res.body.data.health.ok).toBe(true);
    expect(res.body.data.http).toEqual({ error: 'log_unreadable' });
    expect(res.body.data.job.label).toBe('last reminder email');
  });

  it('app-specific kinds are refused for other apps', async () => {
    const res = await agent.get('/api/metrics/dm_payoff?app=sportly');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('kind_not_for_app');
  });

  it('app-specific kinds run their insight', async () => {
    vi.spyOn(dm, 'payoff').mockResolvedValue({ on_track: true });
    const res = await agent.get('/api/metrics/dm_payoff?app=debtmanager');
    expect(res.body).toEqual({ data: { on_track: true } });
  });

  it('caches repeat requests', async () => {
    health.checkHealth.mockClear();
    await agent.get('/api/metrics/health?app=sportly');
    await agent.get('/api/metrics/health?app=sportly');
    expect(health.checkHealth).toHaveBeenCalledTimes(1);
  });

  it('caches errors with shorter TTL envelope', async () => {
    health.checkHealth.mockRejectedValueOnce(new Error('boom'));
    const res = await agent.get('/api/metrics/health?app=honeydoeh');
    expect(res.status).toBe(200);
    expect(res.body.error).toBe('boom');
  });

  it('uptime buckets health_ok samples over the range', async () => {
    const { dbPool } = await import('@server/db.js');
    await dbPool.query(
      `INSERT INTO metric_samples(app_slug, metric, value, taken_at)
       VALUES ('sportly','health_ok',1,NOW() - INTERVAL '1 hour'),
              ('sportly','health_ok',0,NOW() - INTERVAL '1 hour'),
              ('sportly','health_ok',1,NOW() - INTERVAL '30 minutes')`,
    );
    const res = await agent.get('/api/metrics/uptime?app=sportly&range=24h');
    expect(res.status).toBe(200);
    const { buckets } = res.body.data;
    expect(buckets).toHaveLength(48);
    const withData = buckets.filter((b) => b.samples > 0);
    expect(withData.length).toBeGreaterThanOrEqual(1);
    expect(withData.reduce((s, b) => s + b.samples, 0)).toBe(3);
  });

  it('uptime falls back to 7d on unknown range', async () => {
    const res = await agent.get('/api/metrics/uptime?app=sportly&range=90d');
    expect(res.status).toBe(200);
    expect(res.body.data.buckets).toHaveLength(48);
  });
});
