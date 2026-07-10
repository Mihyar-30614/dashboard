import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '@server/app.js';
import { seedAdmin } from '@server/auth/seed.js';
import { appsCache } from '@server/cache.js';
import * as pm2 from '@server/collectors/pm2.js';
import * as health from '@server/collectors/health.js';

let app, agent;
beforeEach(async () => {
  appsCache.clear();
  process.env.DASHBOARD_READER_PASSWORD = 'x';
  await seedAdmin('admin@example.com', 'zX9!muPpetDance#Lurking');
  vi.spyOn(pm2, 'snapshot').mockResolvedValue({
    'sportly-backend': { status: 'online', restarts: 0, cpu: 1, mem_bytes: 100 },
    'honeydoeh-api':   { status: 'online', restarts: 0, cpu: 1, mem_bytes: 100 },
    'debtmanager-api': { status: 'stopped', restarts: 0, cpu: 0, mem_bytes: 0 }
  });
  vi.spyOn(health, 'checkHealth').mockResolvedValue({ ok: true, status: 200, latency_ms: 5 });
  app = buildApp();
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({
    email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking'
  });
});

describe('GET /api/apps', () => {
  it('returns 3 apps with merged status', async () => {
    const res = await agent.get('/api/apps');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    const sportly = res.body.find(a => a.slug === 'sportly');
    expect(sportly.pm2_status).toBe('online');
    expect(sportly.health.ok).toBe(true);
  });

  it('serves cached response within TTL', async () => {
    const healthSpy = vi.spyOn(health, 'checkHealth');
    healthSpy.mockClear();
    await agent.get('/api/apps');
    const callsAfterFirst = healthSpy.mock.calls.length;
    await agent.get('/api/apps');
    expect(healthSpy.mock.calls.length).toBe(callsAfterFirst);
  });
});
