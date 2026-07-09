import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { seedAdmin } from './seed.js';

let app;
beforeEach(async () => {
  await seedAdmin('admin@example.com', 'zX9!muPpetDance#Lurking');
  app = buildApp();
});

describe('POST /api/auth/login', () => {
  it('issues a session cookie on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/^ds=[0-9a-f-]+;/);
  });

  it('rejects bad credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('trusts the nginx proxy hop so limiter keys by client IP', async () => {
    // Behind nginx, req.ip must come from X-Forwarded-For or the login
    // limiter throttles every user under the proxy's address.
    expect(app.get('trust proxy')).toBe(1);
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.7')
      .send({ email: 'admin@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the user after login', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({
      email: 'admin@example.com',
      password: 'zX9!muPpetDance#Lurking'
    });
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@example.com');
    expect(res.body.is_admin).toBe(true);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({
      email: 'admin@example.com',
      password: 'zX9!muPpetDance#Lurking'
    });
    await agent.post('/api/auth/logout');
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
