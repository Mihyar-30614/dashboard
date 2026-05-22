import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { seedAdmin } from '../auth/seed.js';
import { hashPassword } from '../auth/password.js';
import { query } from '../db.js';
import * as dataSources from '../dataSources.js';
import * as sqlWidgetsModule from '../sqlWidgets.js';
import { metricsCache } from '../cache.js';

let app, adminAgent, userAgent;

beforeEach(async () => {
  await query('TRUNCATE sql_widgets');
  // seedAdmin deletes ALL users first — call it once, then insert the non-admin user manually
  await seedAdmin('admin@example.com', 'zX9!muPpetDance#Lurking');
  const hash = await hashPassword('zX9!muPpetDance#Lurking');
  await query(
    `INSERT INTO users(email, password_hash, is_admin, is_active) VALUES($1,$2,false,true)`,
    ['user@example.com', hash]
  );
  metricsCache.clear();
  vi.spyOn(dataSources, 'listDataSources').mockReturnValue([
    { name: 'dashboard', kind: 'dashboard', scope: 'overview' },
    { name: 'sportly', kind: 'app', scope: 'app', app_slug: 'sportly' },
  ]);
  app = buildApp();
  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({
    email: 'admin@example.com', password: 'zX9!muPpetDance#Lurking'
  });
  userAgent = request.agent(app);
  await userAgent.post('/api/auth/login').send({
    email: 'user@example.com', password: 'zX9!muPpetDance#Lurking'
  });
});

describe('GET /api/sql-widgets', () => {
  it('401 without login', async () => {
    const res = await request(app).get('/api/sql-widgets');
    expect(res.status).toBe(401);
  });

  it('returns empty list when no widgets', async () => {
    const res = await adminAgent.get('/api/sql-widgets');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns inserted widgets', async () => {
    await query(`INSERT INTO sql_widgets(name, data_source, sql, viz)
                 VALUES('Test', 'sportly', 'SELECT 1', 'number')`);
    const res = await adminAgent.get('/api/sql-widgets');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Test');
  });
});

describe('GET /api/sql-widgets/sources', () => {
  it('returns the data source list', async () => {
    const res = await adminAgent.get('/api/sql-widgets/sources');
    expect(res.status).toBe(200);
    expect(res.body.map(s => s.name).sort()).toEqual(['dashboard', 'sportly']);
  });
});

describe('GET /api/sql-widgets/:id', () => {
  it('returns one widget', async () => {
    const ins = await query(`INSERT INTO sql_widgets(name, data_source, sql, viz)
                             VALUES('Test', 'sportly', 'SELECT 1', 'number') RETURNING id`);
    const id = ins.rows[0].id;
    const res = await adminAgent.get(`/api/sql-widgets/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(Number(id));
  });

  it('404 for missing', async () => {
    const res = await adminAgent.get('/api/sql-widgets/999999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/sql-widgets/preview', () => {
  beforeEach(() => {
    vi.spyOn(sqlWidgetsModule, 'executeSqlWidget').mockResolvedValue({
      columns: ['value'], rows: [{ value: 42 }], truncated: false, durationMs: 5,
    });
  });

  it('requires admin', async () => {
    const res = await userAgent.post('/api/sql-widgets/preview')
      .send({ data_source: 'sportly', sql: 'SELECT 1', range: '7d' });
    expect(res.status).toBe(403);
  });

  it('returns columns, rows, inferred viz, durationMs on success', async () => {
    const res = await adminAgent.post('/api/sql-widgets/preview')
      .send({ data_source: 'sportly', sql: 'SELECT 1 AS value', range: '7d' });
    expect(res.status).toBe(200);
    expect(res.body.columns).toEqual(['value']);
    expect(res.body.rows).toEqual([{ value: 42 }]);
    expect(res.body.inferred_viz).toBe('number');
    expect(res.body.durationMs).toBe(5);
  });

  it('returns 400 with safe error string on bad SQL', async () => {
    sqlWidgetsModule.executeSqlWidget.mockRejectedValueOnce(new Error('bad_sql'));
    const res = await adminAgent.post('/api/sql-widgets/preview')
      .send({ data_source: 'sportly', sql: 'SELECT 1; SELECT 2', range: '7d' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('bad_sql');
  });

  it('returns 400 for unknown data source', async () => {
    const res = await adminAgent.post('/api/sql-widgets/preview')
      .send({ data_source: 'nope', sql: 'SELECT 1', range: '7d' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unknown_data_source');
  });
});

describe('POST /api/sql-widgets (create)', () => {
  it('requires admin', async () => {
    const res = await userAgent.post('/api/sql-widgets')
      .send({ name: 'X', data_source: 'sportly', sql: 'SELECT 1', viz: 'number' });
    expect(res.status).toBe(403);
  });

  it('rejects missing required fields', async () => {
    const res = await adminAgent.post('/api/sql-widgets').send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown data_source', async () => {
    const res = await adminAgent.post('/api/sql-widgets')
      .send({ name: 'X', data_source: 'nope', sql: 'SELECT 1', viz: 'number' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unknown_data_source');
  });

  it('rejects invalid viz', async () => {
    const res = await adminAgent.post('/api/sql-widgets')
      .send({ name: 'X', data_source: 'sportly', sql: 'SELECT 1', viz: 'pie' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('bad_viz');
  });

  it('creates and returns the widget with numeric id', async () => {
    vi.spyOn(sqlWidgetsModule, 'executeSqlWidget').mockResolvedValue({
      columns: ['v'], rows: [{ v: 1 }], truncated: false, durationMs: 1,
    });
    const res = await adminAgent.post('/api/sql-widgets')
      .send({ name: 'X', data_source: 'sportly', sql: 'SELECT 1', viz: 'number' });
    expect(res.status).toBe(200);
    expect(res.body.id).toEqual(expect.any(Number));
    expect(res.body.name).toBe('X');
  });

  it('rejects create when validation execution fails', async () => {
    vi.spyOn(sqlWidgetsModule, 'executeSqlWidget').mockRejectedValueOnce(new Error('bad_sql'));
    const res = await adminAgent.post('/api/sql-widgets')
      .send({ name: 'X', data_source: 'sportly', sql: 'SELECT 1;SELECT 2', viz: 'number' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('bad_sql');
  });
});

describe('PATCH /api/sql-widgets/:id', () => {
  let id;
  beforeEach(async () => {
    const r = await query(`INSERT INTO sql_widgets(name, data_source, sql, viz)
                           VALUES('X', 'sportly', 'SELECT 1', 'number') RETURNING id`);
    id = r.rows[0].id;
    vi.spyOn(sqlWidgetsModule, 'executeSqlWidget').mockResolvedValue({
      columns: ['v'], rows: [{ v: 1 }], truncated: false, durationMs: 1,
    });
  });
  it('updates name and viz', async () => {
    const res = await adminAgent.patch(`/api/sql-widgets/${id}`)
      .send({ name: 'Renamed', viz: 'table' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
    expect(res.body.viz).toBe('table');
  });
  it('returns 404 for missing id', async () => {
    const res = await adminAgent.patch('/api/sql-widgets/999999').send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/sql-widgets/:id', () => {
  it('removes the row', async () => {
    const r = await query(`INSERT INTO sql_widgets(name, data_source, sql, viz)
                           VALUES('X', 'sportly', 'SELECT 1', 'number') RETURNING id`);
    const id = r.rows[0].id;
    const res = await adminAgent.delete(`/api/sql-widgets/${id}`);
    expect(res.status).toBe(200);
    const after = await query('SELECT id FROM sql_widgets WHERE id=$1', [id]);
    expect(after.rows).toEqual([]);
  });
});

describe('GET /api/sql-widgets/:id/run', () => {
  let id;
  beforeEach(async () => {
    metricsCache.clear();
    const r = await query(`INSERT INTO sql_widgets(name, data_source, sql, viz)
                           VALUES('X', 'sportly', 'SELECT :range_days', 'number')
                           RETURNING id`);
    id = r.rows[0].id;
    vi.spyOn(sqlWidgetsModule, 'executeSqlWidget').mockResolvedValue({
      columns: ['days'], rows: [{ days: 7 }], truncated: false, durationMs: 1,
    });
  });

  it('returns data envelope with rows', async () => {
    const res = await adminAgent.get(`/api/sql-widgets/${id}/run?range=7d`);
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toEqual([{ days: 7 }]);
  });

  it('caches repeat calls within TTL', async () => {
    await adminAgent.get(`/api/sql-widgets/${id}/run?range=7d`);
    await adminAgent.get(`/api/sql-widgets/${id}/run?range=7d`);
    expect(sqlWidgetsModule.executeSqlWidget).toHaveBeenCalledTimes(1);
  });

  it('does not cache across ranges', async () => {
    await adminAgent.get(`/api/sql-widgets/${id}/run?range=7d`);
    await adminAgent.get(`/api/sql-widgets/${id}/run?range=30d`);
    expect(sqlWidgetsModule.executeSqlWidget).toHaveBeenCalledTimes(2);
  });

  it('returns error envelope on execution failure', async () => {
    sqlWidgetsModule.executeSqlWidget.mockRejectedValueOnce(new Error('timeout'));
    const res = await adminAgent.get(`/api/sql-widgets/${id}/run?range=7d`);
    expect(res.status).toBe(200);
    expect(res.body.error).toBe('timeout');
  });

  it('404 for missing widget', async () => {
    const res = await adminAgent.get('/api/sql-widgets/999999/run?range=7d');
    expect(res.status).toBe(404);
  });
});
