import { describe, it, expect } from 'vitest';
import { loadApps } from '@server/config.js';

describe('loadApps', () => {
  it('returns 3 apps with shared dashboard_reader password', () => {
    process.env.DASHBOARD_READER_PASSWORD = 'shared-pw';
    const apps = loadApps();
    expect(Object.keys(apps).sort()).toEqual(['debtmanager', 'honeydoeh', 'sportly']);
    expect(apps.sportly.db.password).toBe('shared-pw');
    expect(apps.honeydoeh.db.password).toBe('shared-pw');
    expect(apps.debtmanager.db.password).toBe('shared-pw');
    expect(apps.sportly.slug).toBe('sportly');
    expect(Array.isArray(apps.sportly.kpis)).toBe(true);
  });
});
