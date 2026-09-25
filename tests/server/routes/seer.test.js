import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import request from 'supertest';

// A fake Seer: streams a CSV in several chunks, and answers other paths with
// a JSON error, recording what the proxy sent.
let upstream;
let seen = [];
beforeAll(async () => {
  upstream = http.createServer((req, res) => {
    seen.push({
      url: req.url,
      key: req.headers['x-api-key'],
      endUser: req.headers['x-seer-end-user'],
      subject: req.headers['x-seer-subject'],
    });
    if (req.url.endsWith('/export.csv')) {
      res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'x-seer-row-count': '3' });
      res.write('id\r\n');
      setTimeout(() => { res.write('1\r\n2\r\n'); setTimeout(() => res.end('3\r\n'), 5); }, 5);
      return;
    }
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ detail: 'This result has 900,000 rows; exports are limited to 200,000.' }));
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  process.env.SEER_API_URL = `http://127.0.0.1:${upstream.address().port}`;
  process.env.SEER_API_KEY = 'test-key';
});

afterAll(() => new Promise((resolve) => upstream.close(resolve)));

async function loggedInAgent() {
  const { seedAdmin } = await import('@server/auth/seed.js');
  const { buildApp } = await import('@server/app.js');
  process.env.DASHBOARD_READER_PASSWORD = 'x';
  await seedAdmin('admin@example.com', 'zX9!muPpetDance#Lurking');
  const agent = request.agent(buildApp());
  await agent.post('/api/auth/login').send({ email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking' });
  return agent;
}

describe('seer proxy', () => {
  it('streams the upstream body and forwards its headers', async () => {
    const agent = await loggedInAgent();
    const res = await agent.get('/api/seer/api/databases/sportly/queries/7/export.csv');
    expect(res.status).toBe(200);
    expect(res.text).toBe('id\r\n1\r\n2\r\n3\r\n');
    expect(res.headers['x-seer-row-count']).toBe('3');
    expect(res.headers['content-type']).toMatch(/^text\/csv/);
    const last = seen.at(-1);
    expect(last.url).toBe('/api/databases/sportly/queries/7/export.csv');
    expect(last.key).toBe('test-key');
    expect(last.endUser).toBeTruthy();
  });

  it('forwards the chosen Seer user', async () => {
    const agent = await loggedInAgent();
    await agent.get('/api/seer/api/databases/sportly/queries/9/other').set('X-Seer-Subject', ' 7, 8 ');
    expect(seen.at(-1).subject).toBe('7, 8');
    await agent.get('/api/seer/api/databases/sportly/queries/9/other');
    expect(seen.at(-1).subject).toBeUndefined();
  });

  it('rejects a malformed Seer user without calling Seer', async () => {
    const agent = await loggedInAgent();
    const before = seen.length;
    const res = await agent.get('/api/seer/api/databases/sportly/users').set('X-Seer-Subject', "1' OR 1=1");
    expect(res.status).toBe(400);
    expect(seen.length).toBe(before);
  });

  it('passes error statuses and bodies through', async () => {
    const agent = await loggedInAgent();
    const res = await agent.get('/api/seer/api/databases/sportly/queries/8/other');
    expect(res.status).toBe(400);
    expect(res.body.detail).toMatch(/900,000 rows/);
  });
});
