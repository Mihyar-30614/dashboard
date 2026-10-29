// Cross-app views for the Overview board. Each app is read independently so
// one app's database or log being unavailable never blanks the whole widget.
import { getAppPool } from "../appPools.js";
import { loadApps } from "../config.js";
import { query } from "../db.js";
import { checkHealth } from "../collectors/health.js";
import { snapshot as pm2Snapshot } from "../collectors/pm2.js";
import { traffic } from "./traffic.js";
import * as dm from "./debtmanager.js";
import * as sp from "./sportly.js";
import * as hd from "./honeydoeh.js";

const settle = (p) => p.then((v) => ({ v }), (e) => ({ e: e.message || "error" }));

export async function fleet() {
  const apps = Object.values(loadApps());
  const [pm2, { rows: uptime }] = await Promise.all([
    settle(pm2Snapshot()),
    query(
      `SELECT app_slug, AVG(value)::float8 AS ratio
         FROM metric_samples
        WHERE metric = 'health_ok' AND taken_at > NOW() - INTERVAL '7 days'
        GROUP BY app_slug`,
    ),
  ]);
  const up = Object.fromEntries(uptime.map((r) => [r.app_slug, r.ratio]));
  const rows = await Promise.all(
    apps.map(async (a) => {
      const [health, http] = await Promise.all([settle(checkHealth(a.health_url)), settle(traffic(a))]);
      return {
        slug: a.slug,
        label: a.label,
        health: health.v ?? { ok: false, error: health.e },
        pm2: pm2.v?.[a.pm2_name]?.status ?? "unknown",
        http: http.v
          ? { per_min: http.v.per_min, errors_5xx: http.v.last_hour.errors_5xx, count: http.v.last_hour.count, buckets: http.v.buckets }
          : { error: http.e },
        uptime_7d: up[a.slug] ?? null,
      };
    }),
  );
  return { apps: rows };
}

// Something you'd act on. severity: bad (broken / money at risk), warn (due soon).
const item = (app, severity, text, detail = null, amount = null) => ({ app, severity, text, detail, amount });

export async function attention() {
  const apps = loadApps();
  const out = [];
  const tasks = [];

  for (const a of Object.values(apps)) {
    tasks.push(
      settle(checkHealth(a.health_url)).then((r) => {
        if (r.e || !r.v.ok) out.push(item(a.slug, "bad", `${a.label} is down`, r.e ?? `http ${r.v.status ?? r.v.error}`));
      }),
      settle(traffic(a)).then((r) => {
        const n = r.v?.last_hour.errors_5xx ?? 0;
        if (n) out.push(item(a.slug, "bad", `${n} server error${n > 1 ? "s" : ""} in the last hour`, `${a.label} · 5xx`));
      }),
    );
  }

  if (apps.sportly) {
    const pool = getAppPool("sportly");
    tasks.push(
      settle(sp.adminTodos(pool)).then((r) => {
        for (const i of r.v?.items ?? []) {
          if (i.count) out.push(item("sportly", i.key === "feedback" ? "warn" : "bad", `${i.count} ${i.label.toLowerCase()}`, "Sportly admin"));
        }
      }),
    );
  }
  if (apps.debtmanager) {
    const pool = getAppPool("debtmanager");
    const cfg = apps.debtmanager;
    tasks.push(
      settle(dm.billsDue(pool, cfg, { days: "7" })).then((r) => {
        for (const b of r.v?.bills ?? []) {
          if (b.covered) continue;
          const when = b.days_until === 0 ? "today" : b.days_until === 1 ? "tomorrow" : `in ${b.days_until} days`;
          out.push(item("debtmanager", b.days_until <= 3 ? "bad" : "warn", `${b.name} payment due ${when}`, "Debtmanager bill",
            { cents: b.min_payment_cents - b.paid_this_cycle_cents, currency: r.v.currency }));
        }
      }),
      settle(dm.paidVsCharged(pool, cfg, { period: "6m" })).then((r) => {
        const m = r.v?.months.at(-1);
        // Only meaningful once the month has some activity on both sides.
        if (m && m.charged_cents > 0 && m.net_cents < 0) {
          out.push(item("debtmanager", "warn", "Charged more than paid this month", "Debtmanager",
            { cents: -m.net_cents, currency: r.v.currency }));
        }
      }),
    );
  }
  if (apps.honeydoeh) {
    const pool = getAppPool("honeydoeh");
    tasks.push(
      settle(hd.todoFlow(pool)).then((r) => {
        if (r.v?.overdue) out.push(item("honeydoeh", "warn", `${r.v.overdue} overdue todo${r.v.overdue > 1 ? "s" : ""}`, "Honey Do Eh"));
      }),
      settle(hd.jobs(pool)).then((r) => {
        if (r.v?.attention) out.push(item("honeydoeh", "bad", `${r.v.attention} notifications stuck sending`, "Honey Do Eh outbox"));
      }),
    );
  }

  await Promise.all(tasks);
  const rank = { bad: 0, warn: 1 };
  out.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return { items: out };
}

export async function week() {
  const apps = loadApps();
  const events = [];
  const tasks = [];
  if (apps.sportly) {
    tasks.push(
      settle(
        getAppPool("sportly").query(
          `SELECT e.title, e.date_time AS at, e.max_participants AS max,
                  (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id)::int AS joined
             FROM events e
            WHERE e.cancelled_at IS NULL AND e.date_time BETWEEN NOW() AND NOW() + INTERVAL '7 days'`,
        ),
      ).then((r) => {
        for (const g of r.v?.rows ?? []) {
          events.push({ app: "sportly", kind: "game", at: g.at, title: g.title, detail: `${g.joined}/${g.max} spots` });
        }
      }),
    );
  }
  if (apps.debtmanager) {
    tasks.push(
      settle(dm.billsDue(getAppPool("debtmanager"), apps.debtmanager, { days: "7" })).then((r) => {
        for (const b of r.v?.bills ?? []) {
          events.push({
            app: "debtmanager",
            kind: "bill",
            at: `${b.due_date}T12:00:00`,
            all_day: true,
            title: `${b.name} payment`,
            detail: b.covered ? "covered" : "minimum due",
            amount: { cents: b.min_payment_cents, currency: r.v.currency },
            done: b.covered,
          });
        }
      }),
    );
  }
  if (apps.honeydoeh) {
    tasks.push(
      settle(
        getAppPool("honeydoeh").query(
          `SELECT t.title, t.due_at AS at, t.priority
             FROM todos t JOIN projects p ON p.id = t.project_id
            WHERE NOT t.completed AND NOT t.archived AND NOT p.archived AND p.deleted_at IS NULL
              AND t.due_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'`,
        ),
      ).then((r) => {
        for (const t of r.v?.rows ?? []) {
          events.push({ app: "honeydoeh", kind: "todo", at: t.at, title: t.title, detail: t.priority ? `${t.priority} priority` : null });
        }
      }),
    );
  }
  await Promise.all(tasks);
  events.sort((a, b) => new Date(a.at) - new Date(b.at));
  return { events };
}

export async function pulse(pool, appCfg) {
  if (appCfg.slug === "sportly") {
    const [wallet, growth, games, ret] = await Promise.all([
      sp.walletMoney(pool),
      sp.growth(pool, appCfg, { range: "7d" }),
      sp.games(pool),
      sp.retention(pool),
    ]);
    const next = games.games.find((g) => !g.cancelled && new Date(g.date_time) > new Date());
    return {
      slug: "sportly",
      wallets_cents: wallet.wallets_cents,
      new_players_7d: growth.signups,
      comeback_pct: ret.repeat_rate_pct,
      next_game: next ? { title: next.title, at: next.date_time, joined: next.joined, max: next.max_participants } : null,
    };
  }
  if (appCfg.slug === "debtmanager") {
    const [p, flows] = await Promise.all([
      dm.payoff(pool, appCfg),
      dm.paidVsCharged(pool, appCfg, { period: "6m" }),
    ]);
    const m = flows.months.at(-1);
    return {
      slug: "debtmanager",
      currency: p.currency,
      debt_free_month: p.debt_free_month,
      on_track: p.on_track,
      owed_cents: p.total_balance_cents,
      interest_cents: p.monthly_interest_cents,
      net_this_month_cents: m?.net_cents ?? 0,
    };
  }
  if (appCfg.slug === "honeydoeh") {
    const [s, t, c] = await Promise.all([hd.spend(pool), hd.todoFlow(pool), hd.priceCreep(pool)]);
    return {
      slug: "honeydoeh",
      currency: s.currency,
      spend_mtd: s.mtd,
      spend_vs_last: s.mtd - s.last_month_same_day,
      open_todos: t.open,
      overdue_todos: t.overdue,
      top_creep: c.items[0] ? { name: c.items[0].name, change_pct: c.items[0].change_pct } : null,
    };
  }
  throw new Error("no_pulse_for_app");
}
