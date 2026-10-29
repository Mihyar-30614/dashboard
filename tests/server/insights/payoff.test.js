import { describe, it, expect } from 'vitest';
import { generatePlan } from '@server/insights/payoff.js';

const debt = (id, balance, aprPct, min) => ({
  id, balance_cents: balance, apr_bps: aprPct * 100, min_payment_cents: min,
});

describe('generatePlan', () => {
  it('pays off a zero-interest debt in balance / budget months', () => {
    const plan = generatePlan([debt(1, 1000_00, 0, 0)], 250_00);
    expect(plan.paidOff).toBe(true);
    expect(plan.payoffMonths).toBe(4);
    expect(plan.totalInterestCents).toBe(0);
  });

  it('sends extra money to the highest APR first', () => {
    const plan = generatePlan([debt(1, 1000_00, 5, 10_00), debt(2, 1000_00, 30, 10_00)], 300_00);
    const m1 = plan.months[0];
    // Interest on both, then minimums, then the rest at debt 2 (30%).
    expect(m1.totalBalanceCents).toBeLessThan(2000_00);
    expect(plan.paidOff).toBe(true);
  });

  it('reports not paid off when the budget does not beat interest', () => {
    const plan = generatePlan([debt(1, 10000_00, 36, 0)], 100_00, 24);
    expect(plan.paidOff).toBe(false);
    expect(plan.months.at(-1).totalBalanceCents).toBeGreaterThan(10000_00);
  });

  it('ignores debts that are already at zero', () => {
    const plan = generatePlan([debt(1, 0, 20, 25_00)], 100_00);
    expect(plan).toMatchObject({ paidOff: true, payoffMonths: 0 });
  });
});
