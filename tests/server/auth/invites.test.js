import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '@server/app.js';
import { seedAdmin } from '@server/auth/seed.js';

let app, agent;
beforeEach(async () => {
  await seedAdmin('admin@example.com', 'zX9!muPpetDance#Lurking');
  app = buildApp();
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({
    email: 'admin@example.com',
    password: 'zX9!muPpetDance#Lurking'
  });
});

describe('invites', () => {
  it('admin creates and lists invites', async () => {
    const create = await agent.post('/api/invites').send({ email: 'b@example.com' });
    expect(create.status).toBe(200);
    expect(create.body.token).toMatch(/^[0-9a-f]{64}$/);

    const list = await agent.get('/api/invites');
    expect(list.body).toHaveLength(1);
  });

  it('accepts an invite and creates a user session', async () => {
    const create = await agent.post('/api/invites').send({ email: 'b@example.com' });
    const token = create.body.token;

    const accept = await request(app)
      .post('/api/auth/accept-invite')
      .send({ token, email: 'b@example.com', password: 'zX9!muPpetDance#Lurking' });
    expect(accept.status).toBe(200);
    expect(accept.headers['set-cookie'][0]).toMatch(/^ds=/);

    const reuse = await request(app)
      .post('/api/auth/accept-invite')
      .send({ token, email: 'c@example.com', password: 'zX9!muPpetDance#Lurking' });
    expect(reuse.status).toBe(400);
  });

  it('rejects non-admin invite create', async () => {
    const create = await agent.post('/api/invites').send({ email: 'b@example.com' });
    await request(app).post('/api/auth/accept-invite').send({
      token: create.body.token,
      email: 'b@example.com',
      password: 'zX9!muPpetDance#Lurking'
    });
    const bAgent = request.agent(app);
    await bAgent.post('/api/auth/login').send({
      email: 'b@example.com',
      password: 'zX9!muPpetDance#Lurking'
    });
    const denied = await bAgent.post('/api/invites').send({ email: 'c@example.com' });
    expect(denied.status).toBe(403);
  });
});
