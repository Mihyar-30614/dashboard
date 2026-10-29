import { Router } from "express";
import { requireAuth } from "../auth/session.js";
import { getAppPool } from "../appPools.js";
import { loadApps } from "../config.js";
import { metricsCache } from "../cache.js";
import { snapshot as pm2Snapshot } from "../collectors/pm2.js";
import { checkHealth } from "../collectors/health.js";
import { query } from "../db.js";
import { KIND_INDEX } from "../widgets/registry.js";
import { traffic, _resetTrafficForTests } from "../insights/traffic.js";
import * as dm from "../insights/debtmanager.js";
import * as sp from "../insights/sportly.js";
import * as hd from "../insights/honeydoeh.js";

const TTL_MS = 30_000;
const ERR_TTL_MS = 10_000;

export function _resetForTests() {
  _resetTrafficForTests();
  metricsCache.clear();
}

const JOBS = {
  debtmanager: (pool) => dm.jobs(pool),
  sportly: (pool) => sp.jobs(pool),
  honeydoeh: (pool) => hd.jobs(pool),
};

const settle = (p) => p.then((v) => ({ v }), (e) => ({ e: e.message || "error" }));

async function appStatus({ pool, appCfg }) {
  const job = JOBS[appCfg.slug];
  const [health, pm2, http, jobs] = await Promise.all([
    settle(checkHealth(appCfg.health_url)),
    settle(pm2Snapshot().then((all) => all[appCfg.pm2_name] || { status: "unknown" })),
    settle(traffic(appCfg)),
    job ? settle(job(pool)) : Promise.resolve({ v: null }),
  ]);
  return {
    health: health.v ?? { ok: false, error: health.e },
    pm2: pm2.v ?? { status: "unknown", error: pm2.e },
    http: http.v ? { errors_5xx: http.v.last_hour.errors_5xx, count: http.v.last_hour.count } : { error: http.e },
    job: jobs.v ?? (jobs.e ? { error: jobs.e } : null),
  };
}

const KINDS = {
  health: ({ appCfg }) => checkHealth(appCfg.health_url),
  pm2: async ({ appCfg }) =>
    (await pm2Snapshot())[appCfg.pm2_name] || { status: "unknown" },
  traffic: ({ appCfg }) => traffic(appCfg),
  app_status: appStatus,
  uptime: async ({ params, appCfg }) => {
    const hours = { "24h": 24, "7d": 168, "30d": 720 }[params.range] || 168;
    const BUCKETS = 48;
    const { rows } = await query(
      `WITH samples AS (
         SELECT width_bucket(
                  extract(epoch FROM taken_at),
                  extract(epoch FROM NOW() - $2::int * INTERVAL '1 hour'),
                  extract(epoch FROM NOW()),
                  $3::int
                ) AS bucket,
                value
           FROM metric_samples
          WHERE app_slug = $1 AND metric = 'health_ok'
            AND taken_at >= NOW() - $2::int * INTERVAL '1 hour'
       )
       SELECT g AS bucket,
              AVG(s.value)::float8 AS ratio,
              COUNT(s.value)::int AS samples
         FROM generate_series(1, $3::int) g
         LEFT JOIN samples s ON s.bucket = g
        GROUP BY g ORDER BY g`,
      [appCfg.slug, hours, BUCKETS],
    );
    return { hours, buckets: rows };
  },

  dm_payoff: ({ pool, appCfg }) => dm.payoff(pool, appCfg),
  dm_interest: ({ pool, appCfg }) => dm.interest(pool, appCfg),
  dm_paid_vs_charged: ({ pool, appCfg, params }) => dm.paidVsCharged(pool, appCfg, params),
  dm_balance_trend: ({ pool, appCfg, params }) => dm.balanceTrend(pool, appCfg, params),
  dm_utilization: ({ pool, appCfg }) => dm.utilization(pool, appCfg),
  dm_cashflow: ({ pool, appCfg, params }) => dm.cashflow(pool, appCfg, params),
  dm_category_movers: ({ pool, appCfg }) => dm.categoryMovers(pool, appCfg),
  dm_bills_due: ({ pool, appCfg, params }) => dm.billsDue(pool, appCfg, params),

  sp_wallet_money: ({ pool }) => sp.walletMoney(pool),
  sp_money_flow: ({ pool, appCfg, params }) => sp.moneyFlow(pool, appCfg, params),
  sp_funnel: ({ pool }) => sp.funnel(pool),
  sp_growth: ({ pool, appCfg, params }) => sp.growth(pool, appCfg, params),
  sp_retention: ({ pool }) => sp.retention(pool),
  sp_invites: ({ pool }) => sp.invites(pool),
  sp_games: ({ pool }) => sp.games(pool),
  sp_admin_todos: ({ pool }) => sp.adminTodos(pool),

  hd_spend: ({ pool }) => hd.spend(pool),
  hd_price_creep: ({ pool }) => hd.priceCreep(pool),
  hd_todo_flow: ({ pool }) => hd.todoFlow(pool),
};

const router = Router();
router.use(requireAuth);

router.get("/:kind", async (req, res) => {
  const kind = req.params.kind;
  if (!KINDS[kind]) return res.status(400).json({ error: "unknown_kind" });

  const app = String(req.query.app || "");
  const apps = loadApps();
  const appCfg = apps[app];
  if (!appCfg) return res.status(400).json({ error: "unknown_app" });
  const only = KIND_INDEX[kind]?.apps;
  if (only && !only.includes(app)) return res.status(400).json({ error: "kind_not_for_app" });

  const params = { ...req.query };
  delete params.app;
  const cacheKey = `${kind}:${app}:${JSON.stringify(params)}`;
  const cached = metricsCache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const pool = getAppPool(app);
    const data = await KINDS[kind]({ pool, appCfg, params });
    const envelope = { data };
    metricsCache.set(cacheKey, envelope, TTL_MS);
    res.json(envelope);
  } catch (err) {
    const envelope = { error: err.message || "collector_error" };
    metricsCache.set(cacheKey, envelope, ERR_TTL_MS);
    res.json(envelope);
  }
});

export default router;
