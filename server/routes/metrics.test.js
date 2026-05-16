import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { seedAdmin } from '../auth/seed.js';
import * as pgUsers from '../collectors/pgUsers.js';
import * as pgActivity from '../collectors/pgActivity.js';
import * as pgKpi from '../collectors/pgKpi.js';
import * as pm2 from '../collectors/pm2.js';
import * as health from '../collectors/health.js';
import * as nginx from '../collectors/nginx.js';
import { _resetForTests } from './metrics.js';

let app, agent;
beforeEach(async () => {
  _resetForTests();
  process.env.APP_DB_PASSWORDS_JSON = JSON.stringify({ sportly: 'x', honeydoeh: 'x', debtmanager: 'x' });
  await seedAdmin('admin@example.com', 'zX9!muPpetDance#Lurking');
  vi.spyOn(pgUsers, 'total').mockResolvedValue(42);
  vi.spyOn(pgUsers, 'timeseries').mockResolvedValue([{ t: '2026-05-16', value: 3 }]);
  vi.spyOn(pgActivity, 'dau').mockResolvedValue(7);
  vi.spyOn(pgActivity, 'timeseries').mockResolvedValue([{ t: '2026-05-16', value: 2 }]);
  vi.spyOn(pgKpi, 'runKpi').mockResolvedValue(99);
  vi.spyOn(pm2, 'snapshot').mockResolvedValue({
    'sportly-backend': { status: 'online', cpu: 1, mem_bytes: 100, restarts: 0 }
  });
  vi.spyOn(health, 'checkHealth').mockResolvedValue({ ok: true, status: 200, latency_ms: 5 });
  vi.spyOn(nginx, 'aggregate').mockResolvedValue({
    count: 50, errors: 2, errors_5xx: 1, p95_ms: 123, nextOffset: 1024
  });
  app = buildApp();
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({
    email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking'
  });
});

describe('GET /api/metrics/:kind', () => {
  it('401 without login', async () => {
    const res = await request(app).get('/api/metrics/users_total?app=sportly');
    expect(res.status).toBe(401);
  });

  it('unknown kind returns 400', async () => {
    const res = await agent.get('/api/metrics/bogus?app=sportly');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unknown_kind');
  });

  it('unknown app returns 400', async () => {
    const res = await agent.get('/api/metrics/users_total?app=nope');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unknown_app');
  });

  it('users_total returns data envelope', async () => {
    const res = await agent.get('/api/metrics/users_total?app=sportly');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: 42 });
  });

  it('dau works', async () => {
    const res = await agent.get('/api/metrics/dau?app=sportly');
    expect(res.body.data).toBe(7);
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

  it('http_rate / http_errors / http_latency share one nginx aggregate', async () => {
    nginx.aggregate.mockClear();
    const r1 = await agent.get('/api/metrics/http_rate?app=sportly');
    const r2 = await agent.get('/api/metrics/http_errors?app=sportly');
    const r3 = await agent.get('/api/metrics/http_latency?app=sportly');
    expect(r1.body.data).toBe(50);
    expect(r2.body.data).toBe(2);
    expect(r3.body.data).toBe(123);
    expect(nginx.aggregate).toHaveBeenCalledTimes(1);
  });

  it('caches repeat requests', async () => {
    pgUsers.total.mockClear();
    await agent.get('/api/metrics/users_total?app=sportly');
    await agent.get('/api/metrics/users_total?app=sportly');
    expect(pgUsers.total).toHaveBeenCalledTimes(1);
  });

  it('caches errors with shorter TTL envelope', async () => {
    pgUsers.total.mockRejectedValueOnce(new Error('boom'));
    const res = await agent.get('/api/metrics/users_total?app=honeydoeh');
    expect(res.status).toBe(200);
    expect(res.body.error).toBe('boom');
  });

  it('kpi runs the matching SQL block', async () => {
    const res = await agent.get('/api/metrics/kpi?app=sportly&key=events_week');
    expect(res.body.data).toBe(99);
    expect(pgKpi.runKpi).toHaveBeenCalled();
  });

  it('kpi unknown key returns error envelope', async () => {
    const res = await agent.get('/api/metrics/kpi?app=sportly&key=nope');
    expect(res.body.error).toBe('unknown_kpi');
  });
});
