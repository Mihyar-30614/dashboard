import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '@server/app.js';
import { seedAdmin } from '@server/auth/seed.js';

let app, agent;
beforeEach(async () => {
  await seedAdmin('a@example.com', 'zX9!muPpetDance#Lurking');
  app = buildApp();
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({
    email: 'a@example.com', password: 'zX9!muPpetDance#Lurking'
  });
});

describe('layouts', () => {
  it('returns a default layout when none saved', async () => {
    const res = await agent.get('/api/layouts/overview');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.layout)).toBe(true);
    expect(res.body.layout.length).toBeGreaterThan(0);
  });

  it('saves and retrieves a custom layout', async () => {
    const layout = [{ id: 'w_1', kind: 'users_total', app: 'sportly', x: 0, y: 0, w: 2, h: 2, params: {} }];
    const put = await agent.put('/api/layouts/sportly').send({ layout });
    expect(put.status).toBe(200);
    const get = await agent.get('/api/layouts/sportly');
    expect(get.body.layout).toEqual(layout);
  });

  it('rejects bad layout payloads', async () => {
    const res = await agent.put('/api/layouts/sportly').send({ layout: 'not-array' });
    expect(res.status).toBe(400);
  });
});
