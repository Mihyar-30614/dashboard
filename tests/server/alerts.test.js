import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computeTransition, handleHealthSample, _resetForTests } from '@server/alerts.js';
import * as mailer from '@server/mailer.js';
import { query } from '@server/db.js';

describe('computeTransition', () => {
  it('stays quiet while up', () => {
    expect(computeTransition('up', true, 0, 3)).toBeNull();
  });
  it('does not alert before the threshold', () => {
    expect(computeTransition('up', false, 1, 3)).toBeNull();
    expect(computeTransition('up', false, 2, 3)).toBeNull();
  });
  it('alerts down at the threshold', () => {
    expect(computeTransition('up', false, 3, 3)).toBe('down');
  });
  it('does not repeat down alerts', () => {
    expect(computeTransition('down', false, 10, 3)).toBeNull();
  });
  it('alerts recovery on first healthy tick', () => {
    expect(computeTransition('down', true, 0, 3)).toBe('up');
  });
});

describe('handleHealthSample', () => {
  const app = { slug: 'sportly', label: 'Sportly', health_url: 'http://localhost:4003/health' };

  beforeEach(async () => {
    _resetForTests();
    await query('TRUNCATE alert_state');
    vi.restoreAllMocks();
  });

  it('emails once after three consecutive failures and records state', async () => {
    const send = vi.spyOn(mailer, 'sendAlertEmail').mockResolvedValue(undefined);
    for (let i = 0; i < 5; i++) await handleHealthSample(app, false);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatch(/down/i);
    expect(send.mock.calls[0][2]).toMatch(/<html/i);
    const { rows } = await query(`SELECT status FROM alert_state WHERE app_slug='sportly'`);
    expect(rows[0].status).toBe('down');
  });

  it('emails recovery and flips state back up', async () => {
    const send = vi.spyOn(mailer, 'sendAlertEmail').mockResolvedValue(undefined);
    for (let i = 0; i < 3; i++) await handleHealthSample(app, false);
    await handleHealthSample(app, true);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toMatch(/up|recovered/i);
    expect(send.mock.calls[1][2]).toMatch(/<html/i);
    const { rows } = await query(`SELECT status FROM alert_state WHERE app_slug='sportly'`);
    expect(rows[0].status).toBe('up');
  });

  it('healthy ticks reset the failure streak', async () => {
    const send = vi.spyOn(mailer, 'sendAlertEmail').mockResolvedValue(undefined);
    await handleHealthSample(app, false);
    await handleHealthSample(app, false);
    await handleHealthSample(app, true);
    await handleHealthSample(app, false);
    await handleHealthSample(app, false);
    expect(send).not.toHaveBeenCalled();
  });
});
