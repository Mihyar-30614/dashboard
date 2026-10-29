import { generatePlan } from "./payoff.js";

// DebtManager has more than one account and they use different currencies,
// so every insight is scoped to the configured owner instead of summed.
async function owner(pool, appCfg) {
  if (!appCfg.owner_email) throw new Error("owner_email_not_configured");
  const { rows } = await pool.query(
    `SELECT id, currency FROM users WHERE lower(email) = lower($1)`,
    [appCfg.owner_email],
  );
  if (!rows[0]) throw new Error("owner_not_found");
  return rows[0];
}

async function activeDebts(pool, userId) {
  const { rows } = await pool.query(
    `SELECT id::int, name, kind,
            balance_cents::float8, apr_bps::float8, min_payment_cents::float8,
            credit_limit_cents::float8, due_day, created_at
       FROM debts
      WHERE user_id = $1 AND active
      ORDER BY balance_cents DESC`,
    [userId],
  );
  return rows;
}

/** Payments and new charges per calendar month, oldest first, current month last. */
async function monthlyFlows(pool, userId, months) {
  const { rows } = await pool.query(
    `WITH months AS (
       SELECT generate_series(
                date_trunc('month', CURRENT_DATE) - ($2::int - 1) * INTERVAL '1 month',
                date_trunc('month', CURRENT_DATE),
                INTERVAL '1 month')::date AS m
     )
     SELECT to_char(m, 'YYYY-MM') AS month,
            COALESCE((SELECT SUM(p.amount_cents) FROM payments p JOIN debts d ON d.id = p.debt_id
                       WHERE d.user_id = $1 AND p.paid_on >= m
                         AND p.paid_on < m + INTERVAL '1 month'), 0)::float8 AS paid_cents,
            COALESCE((SELECT SUM(c.amount_cents) FROM charges c JOIN debts d ON d.id = c.debt_id
                       WHERE d.user_id = $1 AND c.charged_on >= m
                         AND c.charged_on < m + INTERVAL '1 month'), 0)::float8 AS charged_cents
       FROM months ORDER BY m`,
    [userId, months],
  );
  return rows;
}

function monthlyInterestCents(d) {
  return (d.balance_cents * d.apr_bps) / 10000 / 12;
}

function addMonths(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth() + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

async function payoffModel(pool, userId) {
  const [debts, flows] = await Promise.all([
    activeDebts(pool, userId),
    monthlyFlows(pool, userId, 4),
  ]);
  // Pace = what actually went against debt in the last three full months.
  const full = flows.slice(0, 3);
  const paidAvg = avg(full.map((f) => f.paid_cents));
  const chargedAvg = avg(full.map((f) => f.charged_cents));
  const paceCents = Math.round(paidAvg - chargedAvg);
  const owing = debts.filter((d) => d.balance_cents > 0);
  const plan = generatePlan(owing, paceCents);
  const minOnlyCents = owing.reduce((s, d) => s + (d.min_payment_cents || 0), 0);
  const minOnly = generatePlan(owing, minOnlyCents);
  return { debts: owing, paidAvg, chargedAvg, paceCents, plan, minOnly, minOnlyCents };
}

export async function payoff(pool, appCfg) {
  const me = await owner(pool, appCfg);
  const m = await payoffModel(pool, me.id);
  const now = new Date();
  const totalBalance = m.debts.reduce((s, d) => s + d.balance_cents, 0);
  const interestNow = m.debts.reduce((s, d) => s + monthlyInterestCents(d), 0);
  const target = [...m.debts].sort((a, b) => b.apr_bps - a.apr_bps)[0];

  let reason = null;
  if (!m.debts.length) reason = "debt_free";
  else if (m.paceCents <= 0) reason = "charging_more_than_paying";
  else if (!m.plan.paidOff) reason = "interest_exceeds_pace";

  return {
    currency: me.currency,
    total_balance_cents: totalBalance,
    monthly_interest_cents: Math.round(interestNow),
    pace_cents: m.paceCents,
    paid_avg_cents: Math.round(m.paidAvg),
    charged_avg_cents: Math.round(m.chargedAvg),
    on_track: m.debts.length === 0 || m.plan.paidOff,
    reason,
    debt_free_month: m.plan.paidOff ? addMonths(now, m.plan.payoffMonths) : null,
    months_left: m.plan.paidOff ? m.plan.payoffMonths : null,
    interest_remaining_cents: m.plan.paidOff ? m.plan.totalInterestCents : null,
    min_only: {
      monthly_cents: m.minOnlyCents,
      debt_free_month: m.minOnly.paidOff ? addMonths(now, m.minOnly.payoffMonths) : null,
      interest_cents: m.minOnly.paidOff ? m.minOnly.totalInterestCents : null,
    },
    next_target: target ? { name: target.name, apr_bps: target.apr_bps } : null,
  };
}

export async function interest(pool, appCfg) {
  const me = await owner(pool, appCfg);
  const debts = (await activeDebts(pool, me.id)).filter((d) => d.balance_cents > 0);
  const rows = debts
    .map((d) => ({
      name: d.name,
      kind: d.kind,
      balance_cents: d.balance_cents,
      apr_bps: d.apr_bps,
      monthly_cents: Math.round(monthlyInterestCents(d)),
    }))
    .sort((a, b) => b.monthly_cents - a.monthly_cents);
  const monthly = rows.reduce((s, r) => s + r.monthly_cents, 0);
  return {
    currency: me.currency,
    monthly_cents: monthly,
    daily_cents: Math.round((monthly * 12) / 365),
    yearly_cents: monthly * 12,
    debts: rows,
  };
}

export async function paidVsCharged(pool, appCfg, params) {
  const me = await owner(pool, appCfg);
  const months = { "6m": 6, "12m": 12 }[params.period] || 12;
  const flows = await monthlyFlows(pool, me.id, months);
  // Months before the first recorded payment or charge are just empty bars.
  const firstActive = flows.findIndex((f) => f.paid_cents || f.charged_cents);
  return {
    currency: me.currency,
    months: flows.slice(Math.max(0, firstActive)).map((f) => ({
      month: f.month,
      paid_cents: f.paid_cents,
      charged_cents: f.charged_cents,
      net_cents: f.paid_cents - f.charged_cents,
    })),
  };
}

export async function balanceTrend(pool, appCfg, params) {
  const me = await owner(pool, appCfg);
  const days = { "90d": 90, "180d": 180, "1y": 365, all: 36500 }[params.period] || 365;
  const [{ rows: history }, { rows: added }, model] = await Promise.all([
    pool.query(
      `SELECT to_char(snapshot_date, 'YYYY-MM-DD') AS t, SUM(balance_cents)::float8 AS balance_cents
         FROM debt_balance_snapshots
        WHERE user_id = $1 AND snapshot_date >= CURRENT_DATE - $2::int
        GROUP BY snapshot_date ORDER BY snapshot_date`,
      [me.id, days],
    ),
    // A debt appearing shows up as a cliff in the line; label it.
    pool.query(
      `SELECT DISTINCT ON (s.debt_id) to_char(s.snapshot_date, 'YYYY-MM-DD') AS t,
              s.debt_name AS name, s.balance_cents::float8 AS balance_cents
         FROM debt_balance_snapshots s
        WHERE s.user_id = $1
        ORDER BY s.debt_id, s.snapshot_date`,
      [me.id],
    ),
    payoffModel(pool, me.id),
  ]);
  // Debts entered while first setting up the app aren't news; only label ones
  // that arrive a month after tracking began.
  const settled = history[0] ? new Date(new Date(history[0].t).getTime() + 30 * 86400000).toISOString().slice(0, 10) : null;
  const events = added
    .filter((a) => settled && a.t > settled && a.balance_cents > 0)
    .map((a) => ({ t: a.t, label: `${a.name} added`, balance_cents: a.balance_cents }))
    .sort((a, b) => a.t.localeCompare(b.t));
  const peak = history.reduce((p, h) => (!p || h.balance_cents > p.balance_cents ? h : p), null);

  // Monthly projection points continue the line from today until zero.
  const projection = [];
  if (model.plan.paidOff && history.length) {
    const today = new Date();
    projection.push({ t: history[history.length - 1].t, balance_cents: history[history.length - 1].balance_cents });
    for (const mo of model.plan.months) {
      const d = new Date(today.getFullYear(), today.getMonth() + mo.monthIndex, today.getDate());
      projection.push({ t: ymd(d), balance_cents: mo.totalBalanceCents });
    }
  }
  return { currency: me.currency, history, events, projection, peak };
}

export async function utilization(pool, appCfg) {
  const me = await owner(pool, appCfg);
  const lines = (await activeDebts(pool, me.id)).filter((d) => d.credit_limit_cents > 0);
  const balance = lines.reduce((s, d) => s + d.balance_cents, 0);
  const limit = lines.reduce((s, d) => s + d.credit_limit_cents, 0);
  return {
    currency: me.currency,
    overall_pct: limit ? (balance / limit) * 100 : null,
    balance_cents: balance,
    limit_cents: limit,
    lines: lines
      .map((d) => ({
        name: d.name,
        kind: d.kind,
        balance_cents: d.balance_cents,
        limit_cents: d.credit_limit_cents,
        pct: (d.balance_cents / d.credit_limit_cents) * 100,
      }))
      .sort((a, b) => b.pct - a.pct),
  };
}

export async function cashflow(pool, appCfg, params) {
  const me = await owner(pool, appCfg);
  const months = { "6m": 6, "12m": 12 }[params.period] || 12;
  const { rows } = await pool.query(
    `WITH b AS (
       SELECT id, year, month, income_cents FROM budgets
        WHERE user_id = $1
          AND make_date(year, month, 1) > date_trunc('month', CURRENT_DATE) - $2::int * INTERVAL '1 month'
     ),
     inc AS (
       SELECT b.year, b.month,
              COALESCE(SUM(i.amount_cents), 0)::float8 AS received,
              MAX(b.income_cents)::float8 AS planned
         FROM b LEFT JOIN budget_incomes i ON i.budget_id = b.id
        GROUP BY b.year, b.month
     ),
     exp AS (
       SELECT b.year, b.month,
              COALESCE(SUM(e.amount_cents) FILTER (WHERE NOT c.is_debt_payoff), 0)::float8 AS living,
              COALESCE(SUM(e.amount_cents) FILTER (WHERE c.is_debt_payoff), 0)::float8 AS payoff
         FROM b JOIN budget_categories c ON c.budget_id = b.id
         JOIN budget_expenses e ON e.budget_category_id = c.id
        GROUP BY b.year, b.month
     )
     SELECT to_char(make_date(inc.year, inc.month, 1), 'YYYY-MM') AS month,
            CASE WHEN inc.received > 0 THEN inc.received ELSE inc.planned END AS income_cents,
            COALESCE(exp.living, 0) AS living_cents,
            COALESCE(exp.payoff, 0) AS payoff_cents
       FROM inc LEFT JOIN exp USING (year, month)
      ORDER BY inc.year, inc.month`,
    [me.id, months],
  );
  return {
    currency: me.currency,
    months: rows.map((r) => ({
      ...r,
      left_cents: r.income_cents - r.living_cents - r.payoff_cents,
      savings_rate_pct: r.income_cents > 0 ? ((r.income_cents - r.living_cents) / r.income_cents) * 100 : null,
    })),
  };
}

export async function categoryMovers(pool, appCfg) {
  const me = await owner(pool, appCfg);
  // Month-to-date vs the same days of the previous three months, so the 3rd
  // of the month isn't compared against three full months.
  const { rows } = await pool.query(
    `WITH spend AS (
       SELECT c.name AS category, e.spent_on, e.amount_cents
         FROM budget_expenses e
         JOIN budget_categories c ON c.id = e.budget_category_id
         JOIN budgets b ON b.id = c.budget_id
        WHERE b.user_id = $1 AND NOT c.is_debt_payoff
          AND e.spent_on >= date_trunc('month', CURRENT_DATE) - INTERVAL '3 months'
          AND EXTRACT(DAY FROM e.spent_on) <= EXTRACT(DAY FROM CURRENT_DATE)
     )
     SELECT category,
            COALESCE(SUM(amount_cents) FILTER (WHERE spent_on >= date_trunc('month', CURRENT_DATE)), 0)::float8 AS mtd_cents,
            (COALESCE(SUM(amount_cents) FILTER (WHERE spent_on < date_trunc('month', CURRENT_DATE)), 0) / 3.0)::float8 AS baseline_cents
       FROM spend GROUP BY category`,
    [me.id],
  );
  const cats = rows
    .map((r) => ({ ...r, delta_cents: r.mtd_cents - r.baseline_cents }))
    .filter((r) => r.mtd_cents > 0 || r.baseline_cents > 0)
    .sort((a, b) => b.delta_cents - a.delta_cents);
  const mtd = cats.reduce((s, r) => s + r.mtd_cents, 0);
  const baseline = cats.reduce((s, r) => s + r.baseline_cents, 0);
  return {
    currency: me.currency,
    day_of_month: new Date().getDate(),
    mtd_cents: mtd,
    baseline_cents: baseline,
    categories: cats,
  };
}

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function dueDateOn(year, month, day) {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

export async function billsDue(pool, appCfg, params) {
  const me = await owner(pool, appCfg);
  const horizon = Number(params.days) || 14;
  const debts = (await activeDebts(pool, me.id)).filter(
    (d) => d.balance_cents > 0 && d.due_day,
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bills = [];
  for (const d of debts) {
    let next = dueDateOn(today.getFullYear(), today.getMonth(), d.due_day);
    if (next < today) next = dueDateOn(today.getFullYear(), today.getMonth() + 1, d.due_day);
    const days = Math.round((next - today) / 86400000);
    if (days > horizon) continue;
    const prev = dueDateOn(next.getFullYear(), next.getMonth() - 1, d.due_day);
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(amount_cents), 0)::float8 AS paid
         FROM payments WHERE debt_id = $1 AND paid_on > $2::date`,
      [d.id, ymd(prev)],
    );
    bills.push({
      name: d.name,
      due_date: ymd(next),
      days_until: days,
      min_payment_cents: d.min_payment_cents,
      paid_this_cycle_cents: rows[0].paid,
      covered: rows[0].paid >= d.min_payment_cents,
    });
  }
  bills.sort((a, b) => a.days_until - b.days_until);
  return { currency: me.currency, horizon_days: horizon, bills };
}

export async function jobs(pool) {
  const { rows } = await pool.query(
    `SELECT MAX(sent_at) AS last_reminder FROM reminder_log`,
  );
  return { label: "last reminder email", last_at: rows[0].last_reminder, attention: 0 };
}
