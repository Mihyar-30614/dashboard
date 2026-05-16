import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { seedAdmin } from '../auth/seed.js';

let app, agent;
beforeEach(async () => {
  await seedAdmin('a@example.com', 'zX9!muPpetDance#Lurking');
  app = buildApp();
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({
    email: 'a@example.com', password: 'zX9!muPpetDance#Lurking'
  });
});

describe('GET /api/widgets', () => {
  it('returns registry behind auth', async () => {
    const res = await agent.get('/api/widgets');
    expect(res.status).toBe(200);
    expect(res.body.find(w => w.kind === 'users_total')).toBeTruthy();
  });

  it('401 without login', async () => {
    const res = await request(app).get('/api/widgets');
    expect(res.status).toBe(401);
  });
});
