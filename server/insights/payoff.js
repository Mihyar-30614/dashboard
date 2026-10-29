// Port of DebtManager's backend/src/utils/planning.js generatePlan (avalanche
// only) so the dashboard's debt-free date matches what the app itself shows.
// Keep the two in step if the app's simulation changes.

function monthlyRate(aprBps) {
  return Number(aprBps) / 10000 / 12;
}

export function generatePlan(debts, monthlyBudgetCents, maxMonths = 600) {
  const active = debts
    .filter((d) => Number(d.balance_cents) > 0)
    .map((d) => ({ ...d }));
  const balances = new Map(active.map((d) => [d.id, Number(d.balance_cents)]));
  const months = [];
  let totalInterestCents = 0;

  const byApr = () =>
    active
      .filter((d) => balances.get(d.id) > 0)
      .sort((a, b) => Number(b.apr_bps) - Number(a.apr_bps));

  for (let monthIndex = 1; monthIndex <= maxMonths; monthIndex += 1) {
    if (!active.some((d) => balances.get(d.id) > 0)) {
      return { months, payoffMonths: monthIndex - 1, totalInterestCents, paidOff: true };
    }

    let remaining = Math.max(0, Number(monthlyBudgetCents) || 0);
    let monthInterest = 0;

    for (const d of active) {
      const bal = balances.get(d.id);
      if (bal <= 0) continue;
      const interest = Math.max(0, Math.round(bal * monthlyRate(d.apr_bps)));
      balances.set(d.id, bal + interest);
      monthInterest += interest;
    }
    totalInterestCents += monthInterest;

    for (const d of active) {
      const bal = balances.get(d.id);
      if (bal <= 0 || remaining <= 0) continue;
      const minPay = Math.min(Number(d.min_payment_cents) || 0, remaining, bal);
      if (minPay > 0) {
        balances.set(d.id, bal - minPay);
        remaining -= minPay;
      }
    }

    while (remaining > 0) {
      const target = byApr()[0];
      if (!target) break;
      const pay = Math.min(remaining, balances.get(target.id));
      balances.set(target.id, balances.get(target.id) - pay);
      remaining -= pay;
    }

    let totalBalanceCents = 0;
    for (const v of balances.values()) totalBalanceCents += v;
    months.push({ monthIndex, interestCents: monthInterest, totalBalanceCents });
  }

  // Horizon exhausted with balances remaining: the budget doesn't beat interest.
  return { months, payoffMonths: maxMonths, totalInterestCents, paidOff: false };
}
