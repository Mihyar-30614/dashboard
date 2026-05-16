import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { seedAdmin } from '../auth/seed.js';
import * as pm2 from '../collectors/pm2.js';
import * as health from '../collectors/health.js';

let app, agent;
beforeEach(async () => {
  process.env.APP_DB_PASSWORDS_JSON = JSON.stringify({ sportly: 'x', honeydoeh: 'x', debtmanager: 'x' });
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
});
