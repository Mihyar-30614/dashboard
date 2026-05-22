import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadDataSources, _resetForTests, getReadOnlyPool, closeAllReadOnlyPools } from './dataSources.js';

let tmpFile;
beforeEach(() => {
  tmpFile = path.join(os.tmpdir(), `ds-${Date.now()}.json`);
  _resetForTests();
});
afterEach(() => {
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  delete process.env.DATA_SOURCE_RO_PASSWORDS_JSON;
});

describe('loadDataSources', () => {
  it('returns dashboard entry from env when JSON file missing', () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'dashboard';
    process.env.DB_USER = 'dashboard';
    const sources = loadDataSources('/nonexistent.json');
    expect(sources.dashboard).toBeDefined();
    expect(sources.dashboard.scope).toBe('overview');
    expect(sources.dashboard.kind).toBe('dashboard');
  });

  it('merges entries from JSON file with passwords from env', () => {
    fs.writeFileSync(tmpFile, JSON.stringify({
      sportly: {
        kind: 'app', scope: 'app', app_slug: 'sportly',
        db_ro: { host: 'localhost', port: 5432, database: 'sportly', user: 'sportly_ro' }
      }
    }));
    process.env.DATA_SOURCE_RO_PASSWORDS_JSON = JSON.stringify({ sportly: 'pw1' });
    const sources = loadDataSources(tmpFile);
    expect(sources.sportly.db_ro.password).toBe('pw1');
    expect(sources.sportly.app_slug).toBe('sportly');
  });

  it('still emits dashboard entry when JSON file has only app entries', () => {
    fs.writeFileSync(tmpFile, JSON.stringify({
      sportly: { kind: 'app', scope: 'app', app_slug: 'sportly',
        db_ro: { host: 'h', port: 1, database: 'd', user: 'u' } }
    }));
    const sources = loadDataSources(tmpFile);
    expect(sources.dashboard).toBeDefined();
    expect(sources.sportly).toBeDefined();
  });

  it('lets JSON dashboard entry override env-derived one', () => {
    fs.writeFileSync(tmpFile, JSON.stringify({
      dashboard: { kind: 'dashboard', scope: 'overview',
        db_ro: { host: 'override', port: 9999, database: 'd', user: 'u' } }
    }));
    const sources = loadDataSources(tmpFile);
    expect(sources.dashboard.db_ro.host).toBe('override');
  });
});

describe('getReadOnlyPool', () => {
  beforeEach(() => _resetForTests());
  afterEach(async () => { await closeAllReadOnlyPools(); });

  it('throws on unknown data source', () => {
    expect(() => getReadOnlyPool('does_not_exist')).toThrow('unknown_data_source');
  });

  it('caches a pool per data source name', () => {
    fs.writeFileSync(tmpFile, JSON.stringify({
      dashboard: { kind: 'dashboard', scope: 'overview',
        db_ro: { host: 'h', port: 1, database: 'd', user: 'u', password: '' } }
    }));
    const a = getReadOnlyPool('dashboard', tmpFile);
    const b = getReadOnlyPool('dashboard', tmpFile);
    expect(a).toBe(b);
  });
});
