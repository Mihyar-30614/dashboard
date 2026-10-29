import {
  BarList,
  Empty,
  Hero,
  InsightFrame,
  Meter,
  Note,
  Pill,
  SeriesChart,
  Stats,
  dayLabel,
  money,
  monthLabel,
  monthsSpan,
  pct,
  useInsight,
  type Tone,
  type WidgetProps,
} from "./parts";

const APP = "debtmanager";
const apr = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}% APR`;

type Payoff = {
  currency: string;
  total_balance_cents: number;
  monthly_interest_cents: number;
  pace_cents: number;
  paid_avg_cents: number;
  charged_avg_cents: number;
  on_track: boolean;
  reason: null | "debt_free" | "charging_more_than_paying" | "interest_exceeds_pace";
  debt_free_month: string | null;
  months_left: number | null;
  interest_remaining_cents: number | null;
  min_only: { monthly_cents: number; debt_free_month: string | null; interest_cents: number | null };
  next_target: { name: string; apr_bps: number } | null;
};

export function DmPayoff({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Payoff>("dm_payoff", { app: APP });
  const c = d?.currency;
  return (
    <InsightFrame title="Debt-free date" meta="at your 3-month pace" loading={loading} error={error} onRemove={onRemove}>
      {d && (
        <div className="ins-stack">
          {d.reason === "debt_free" ? (
            <Hero value="Debt-free" tone="ok" label="no active balances" />
          ) : d.on_track && d.debt_free_month ? (
            <Hero value={monthLabel(d.debt_free_month)} tone="accent" label="debt-free">
              <Note>
                {monthsSpan(d.months_left ?? 0)} to go · {money(d.interest_remaining_cents, c)} interest left
              </Note>
            </Hero>
          ) : (
            <Hero value="Not on track" tone="bad">
              <Note tone="bad">
                {d.reason === "charging_more_than_paying"
                  ? `New charges (${money(d.charged_avg_cents, c)}/mo) outpace payments (${money(d.paid_avg_cents, c)}/mo).`
                  : `Interest (${money(d.monthly_interest_cents, c)}/mo) eats your ${money(d.pace_cents, c)}/mo net paydown.`}
              </Note>
            </Hero>
          )}
          <Stats
            items={[
              { label: "owed", value: money(d.total_balance_cents, c) },
              {
                label: "net paydown / mo",
                value: money(d.pace_cents, c),
                tone: d.pace_cents > 0 ? "ok" : "bad",
                hint: `paid ${money(d.paid_avg_cents, c)} − charged ${money(d.charged_avg_cents, c)}, avg of last 3 full months`,
              },
              { label: "interest / mo", value: money(d.monthly_interest_cents, c) },
            ]}
          />
          {d.min_only.debt_free_month && d.on_track && d.months_left != null && (
            <Note>
              Minimums only ({money(d.min_only.monthly_cents, c)}/mo): {monthLabel(d.min_only.debt_free_month)},{" "}
              {money(d.min_only.interest_cents, c)} interest. Your pace saves{" "}
              <strong>
                {money((d.min_only.interest_cents ?? 0) - (d.interest_remaining_cents ?? 0), c)}
              </strong>
              .
            </Note>
          )}
          {d.next_target && (
            <Note>
              Next extra dollar → <strong>{d.next_target.name}</strong> ({apr(d.next_target.apr_bps)})
            </Note>
          )}
        </div>
      )}
    </InsightFrame>
  );
}

type Interest = {
  currency: string;
  monthly_cents: number;
  daily_cents: number;
  yearly_cents: number;
  debts: { name: string; kind: string; balance_cents: number; apr_bps: number; monthly_cents: number }[];
};

export function DmInterest({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Interest>("dm_interest", { app: APP });
  const c = d?.currency;
  return (
    <InsightFrame title="Interest burn" meta="at today's balances" loading={loading} error={error} onRemove={onRemove}>
      {d && (
        <div className="ins-stack">
          <Hero
            value={money(d.monthly_cents, c)}
            label={`a month · ${money(d.daily_cents, c)} a day · ${money(d.yearly_cents, c, { compact: true })} a year`}
            tone={d.monthly_cents > 0 ? "warn" : "ok"}
          />
          {d.debts.length ? (
            <BarList
              rows={d.debts.map((x) => ({
                key: x.name,
                label: x.name,
                value: x.monthly_cents,
                display: `${money(x.monthly_cents, c)}/mo`,
                sub: `${money(x.balance_cents, c)} at ${apr(x.apr_bps)}`,
                tone: x.monthly_cents > 0 ? "warn" : "muted",
              }))}
            />
          ) : (
            <Empty>No balances accruing interest.</Empty>
          )}
        </div>
      )}
    </InsightFrame>
  );
}

type Flows = {
  currency: string;
  months: { month: string; paid_cents: number; charged_cents: number; net_cents: number }[];
};

export function DmPaidVsCharged({ params = {}, onRemove }: WidgetProps) {
  const period = params.period || "12m";
  const { data: d, error, loading } = useInsight<Flows>("dm_paid_vs_charged", { app: APP, period });
  const c = d?.currency;
  const worse = d?.months.filter((m) => m.net_cents < 0) ?? [];
  return (
    <InsightFrame title="Paid vs charged" meta={period} loading={loading} error={error} onRemove={onRemove}>
      {d && (
        <div className="ins-stack ins-stack--fill">
          <Note tone={worse.length ? "warn" : "ok"}>
            {worse.length
              ? `Charged more than paid in ${worse.map((m) => monthLabel(m.month, true)).join(", ")}.`
              : "Paid more than you charged every month."}
          </Note>
          <SeriesChart
            data={d.months}
            xKey="month"
            xFormat={(m) => monthLabel(m, true)}
            yFormat={(v) => money(v, c, { compact: true })}
            tipFormat={(v) => money(v, c)}
            refs={[{ y: 0 }]}
            series={[
              { key: "paid_cents", label: "Paid", color: "var(--ok)", kind: "bar" },
              { key: "charged_cents", label: "Charged", color: "var(--bad)", kind: "bar" },
              { key: "net_cents", label: "Net paydown", color: "var(--accent)", kind: "line" },
            ]}
          />
        </div>
      )}
    </InsightFrame>
  );
}

type Trend = {
  currency: string;
  history: { t: string; balance_cents: number }[];
  events: { t: string; label: string; balance_cents: number }[];
  projection: { t: string; balance_cents: number }[];
  peak: { t: string; balance_cents: number } | null;
};

export function DmBalanceTrend({ params = {}, onRemove }: WidgetProps) {
  const period = params.period || "1y";
  const { data: d, error, loading } = useInsight<Trend>("dm_balance_trend", { app: APP, period });
  const c = d?.currency;
  const last = d?.history.at(-1)?.balance_cents ?? 0;
  const fromPeak = d?.peak ? last - d.peak.balance_cents : 0;
  const rows = d
    ? [
        ...d.history.map((h) => ({ t: h.t, actual: h.balance_cents })),
        ...d.projection.slice(1).map((p) => ({ t: p.t, projected: p.balance_cents })),
      ]
    : [];
  if (d?.projection.length && rows.length) {
    // Join the dashed projection to the end of the solid line.
    const joinAt = rows.findIndex((r) => r.t === d.projection[0].t);
    if (joinAt >= 0) (rows[joinAt] as any).projected = d.projection[0].balance_cents;
  }
  return (
    <InsightFrame title="Balance trajectory" meta={period} loading={loading} error={error} onRemove={onRemove}>
      {d &&
        (d.history.length ? (
          <div className="ins-stack ins-stack--fill">
            <div className="ins-row">
              <Hero value={money(last, c)} label="owed today" />
              <Stats
                items={[
                  ...(d.peak && fromPeak < 0
                    ? [{ label: `from ${dayLabel(d.peak.t)} peak`, value: money(fromPeak, c, { sign: true }), tone: "ok" as Tone }]
                    : []),
                  ...(d.projection.length
                    ? [{ label: "zero by", value: monthLabel(d.projection.at(-1)!.t.slice(0, 7)), tone: "accent" as Tone }]
                    : []),
                ]}
              />
            </div>
            {d.events.length > 0 && (
              <Note>
                {d.events.map((e) => `${dayLabel(e.t)}: ${e.label} (${money(e.balance_cents, c)})`).join(" · ")}
              </Note>
            )}
            <SeriesChart
              data={rows}
              xKey="t"
              xFormat={dayLabel}
              yFormat={(v) => money(v, c, { compact: true })}
              tipFormat={(v) => money(v, c)}
              refs={d.events.map((e) => ({ x: e.t }))}
              series={[
                { key: "actual", label: "Balance", color: "var(--chart-1)", kind: "area" },
                ...(d.projection.length
                  ? [{ key: "projected", label: "Projected", color: "var(--chart-1)", kind: "line" as const, dashed: true }]
                  : []),
              ]}
            />
          </div>
        ) : (
          <Empty>No balance snapshots in this range.</Empty>
        ))}
    </InsightFrame>
  );
}

type Util = {
  currency: string;
  overall_pct: number | null;
  balance_cents: number;
  limit_cents: number;
  lines: { name: string; kind: string; balance_cents: number; limit_cents: number; pct: number }[];
};

const utilTone = (p: number): Tone => (p <= 10 ? "ok" : p <= 30 ? "warn" : "bad");

export function DmUtilization({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Util>("dm_utilization", { app: APP });
  const c = d?.currency;
  return (
    <InsightFrame title="Credit utilization" meta="under 30% helps your score, under 10% is best" loading={loading} error={error} onRemove={onRemove}>
      {d &&
        (d.lines.length ? (
          <div className="ins-stack">
            <Hero
              value={pct(d.overall_pct, 1)}
              tone={utilTone(d.overall_pct ?? 0)}
              label={`${money(d.balance_cents, c)} of ${money(d.limit_cents, c)} available credit`}
            />
            <ul className="ins-bars">
              {d.lines.map((l) => (
                <li key={l.name} className="ins-bars__row">
                  <div className="ins-bars__head">
                    <span className="ins-bars__label">{l.name}</span>
                    <span className={`metric ins-bars__value ins-tone--${utilTone(l.pct)}`}>{pct(l.pct)}</span>
                  </div>
                  <Meter value={l.pct} tone={utilTone(l.pct)} marks={[10, 30]} />
                  <div className="ins-bars__sub">
                    {money(l.balance_cents, c)} / {money(l.limit_cents, c)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Empty>No cards or lines of credit with a limit.</Empty>
        ))}
    </InsightFrame>
  );
}

type Cashflow = {
  currency: string;
  months: {
    month: string;
    income_cents: number;
    living_cents: number;
    payoff_cents: number;
    left_cents: number;
    savings_rate_pct: number | null;
  }[];
};

export function DmCashflow({ params = {}, onRemove }: WidgetProps) {
  const period = params.period || "12m";
  const { data: d, error, loading } = useInsight<Cashflow>("dm_cashflow", { app: APP, period });
  const c = d?.currency;
  // The current month is still filling in; judge on complete months.
  const done = d?.months.slice(0, -1) ?? [];
  const over = done.filter((m) => m.living_cents > m.income_cents);
  const rates = done.map((m) => m.savings_rate_pct).filter((r): r is number => r != null);
  const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  return (
    <InsightFrame title="Income vs spending" meta={period} loading={loading} error={error} onRemove={onRemove}>
      {d &&
        (d.months.length ? (
          <div className="ins-stack ins-stack--fill">
            <Stats
              items={[
                {
                  label: "avg kept after living costs",
                  value: pct(avgRate),
                  tone: avgRate == null ? undefined : avgRate >= 20 ? "ok" : avgRate >= 0 ? "warn" : "bad",
                },
                { label: "months over income", value: `${over.length} of ${done.length}`, tone: over.length ? "bad" : "ok" },
              ]}
            />
            <SeriesChart
              data={d.months}
              xKey="month"
              xFormat={(m) => monthLabel(m, true)}
              yFormat={(v) => money(v, c, { compact: true })}
              tipFormat={(v) => money(v, c)}
              series={[
                { key: "living_cents", label: "Living", color: "var(--chart-3)", kind: "bar", stack: "out" },
                { key: "payoff_cents", label: "Debt payoff", color: "var(--chart-6)", kind: "bar", stack: "out" },
                { key: "income_cents", label: "Income", color: "var(--chart-2)", kind: "line" },
              ]}
            />
          </div>
        ) : (
          <Empty>No budgets in this range.</Empty>
        ))}
    </InsightFrame>
  );
}

type Movers = {
  currency: string;
  day_of_month: number;
  mtd_cents: number;
  baseline_cents: number;
  categories: { category: string; mtd_cents: number; baseline_cents: number; delta_cents: number }[];
};

export function DmCategoryMovers({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Movers>("dm_category_movers", { app: APP });
  const c = d?.currency;
  const delta = d ? d.mtd_cents - d.baseline_cents : 0;
  const up = d?.categories.filter((x) => x.delta_cents > 0).slice(0, 4) ?? [];
  const down = d?.categories.filter((x) => x.delta_cents < 0).sort((a, b) => a.delta_cents - b.delta_cents).slice(0, 2) ?? [];
  return (
    <InsightFrame
      title="Category movers"
      meta={d ? `first ${d.day_of_month} days vs the same days of the last 3 months` : undefined}
      loading={loading}
      error={error}
      onRemove={onRemove}
    >
      {d && (
        <div className="ins-stack">
          <Hero
            value={money(d.mtd_cents, c)}
            label={
              <>
                spent this month ·{" "}
                <Pill tone={delta > 0 ? "bad" : "ok"}>{money(delta, c, { sign: true })} vs usual</Pill>
              </>
            }
          />
          {up.length + down.length ? (
            <BarList
              rows={[...up, ...down].map((x) => ({
                key: x.category,
                label: x.category,
                value: x.delta_cents,
                display: money(x.delta_cents, c, { sign: true }),
                sub: `${money(x.mtd_cents, c)} now · usually ${money(x.baseline_cents, c)}`,
                tone: x.delta_cents > 0 ? "bad" : "ok",
              }))}
            />
          ) : (
            <Empty>Spending matches the usual pattern.</Empty>
          )}
        </div>
      )}
    </InsightFrame>
  );
}

type Bills = {
  currency: string;
  horizon_days: number;
  bills: {
    name: string;
    due_date: string;
    days_until: number;
    min_payment_cents: number;
    paid_this_cycle_cents: number;
    covered: boolean;
  }[];
};

export function DmBillsDue({ params = {}, onRemove }: WidgetProps) {
  const days = params.days || "14";
  const { data: d, error, loading } = useInsight<Bills>("dm_bills_due", { app: APP, days });
  const c = d?.currency;
  const open = d?.bills.filter((b) => !b.covered) ?? [];
  return (
    <InsightFrame title="Bills due" meta={`next ${days} days`} loading={loading} error={error} onRemove={onRemove}>
      {d &&
        (d.bills.length ? (
          <div className="ins-stack">
            <Note tone={open.length ? "warn" : "ok"}>
              {open.length
                ? `${money(open.reduce((s, b) => s + b.min_payment_cents - b.paid_this_cycle_cents, 0), c)} still to pay`
                : "Every minimum is already covered."}
            </Note>
            <ul className="ins-list">
              {d.bills.map((b) => (
                <li key={b.name} className="ins-list__row">
                  <div>
                    <div className="ins-list__title">{b.name}</div>
                    <div className="ins-list__sub">
                      {b.days_until === 0 ? "today" : b.days_until === 1 ? "tomorrow" : `in ${b.days_until} days`} ·{" "}
                      {dayLabel(b.due_date)}
                    </div>
                  </div>
                  <div className="ins-list__end">
                    <span className="metric">{money(b.min_payment_cents, c)}</span>
                    <Pill tone={b.covered ? "ok" : b.days_until <= 3 ? "bad" : "warn"}>
                      {b.covered ? "covered" : "due"}
                    </Pill>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Empty>Nothing due in the next {days} days.</Empty>
        ))}
    </InsightFrame>
  );
}
