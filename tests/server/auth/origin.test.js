import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '@server/app.js';
import { seedAdmin } from '@server/auth/seed.js';

let app;
beforeEach(async () => {
  await seedAdmin('admin@example.com', 'zX9!muPpetDance#Lurking');
  process.env.APP_ORIGIN = 'http://localhost';
  app = buildApp();
});

describe('CSRF', () => {
  it('rejects POST with foreign Origin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://evil.example.com')
      .send({ email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking' });
    expect(res.status).toBe(403);
  });

  it('allows POST with matching Origin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost')
      .send({ email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking' });
    expect(res.status).toBe(200);
  });

  it('allows POST with no Origin (curl)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking' });
    expect(res.status).toBe(200);
  });
});
