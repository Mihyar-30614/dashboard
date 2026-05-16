import { describe, it, expect } from 'vitest';
import { loadApps } from './config.js';

describe('loadApps', () => {
  it('returns 3 apps with merged passwords', () => {
    process.env.APP_DB_PASSWORDS_JSON = JSON.stringify({ sportly: 'pw1', honeydoeh: 'pw2', debtmanager: 'pw3' });
    const apps = loadApps();
    expect(Object.keys(apps).sort()).toEqual(['debtmanager', 'honeydoeh', 'sportly']);
    expect(apps.sportly.db.password).toBe('pw1');
    expect(apps.sportly.slug).toBe('sportly');
    expect(Array.isArray(apps.sportly.kpis)).toBe(true);
  });
});
