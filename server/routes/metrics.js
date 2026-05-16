import { Router } from "express";
import { requireAuth } from "../auth/session.js";
import { getAppPool } from "../appPools.js";
import { loadApps } from "../config.js";
import { metricsCache } from "../cache.js";
import * as pgUsers from "../collectors/pgUsers.js";
import * as pgActivity from "../collectors/pgActivity.js";
import { runKpi } from "../collectors/pgKpi.js";
import { snapshot as pm2Snapshot } from "../collectors/pm2.js";
import { checkHealth } from "../collectors/health.js";
import { aggregate } from "../collectors/nginx.js";
import { dbPool } from "../db.js";

const TTL_MS = 30_000;
const ERR_TTL_MS = 10_000;
const NGINX_AGG_TTL_MS = 5_000;

const nginxOffsets = new Map();
const nginxAggCache = new Map();

export function _resetForTests() {
  nginxOffsets.clear();
  nginxAggCache.clear();
  metricsCache.clear();
}

async function getNginxAgg(appCfg) {
  const slug = appCfg.slug;
  const cached = nginxAggCache.get(slug);
  if (cached && cached.until > Date.now()) return cached.agg;
  const off = nginxOffsets.get(slug) || 0;
  const agg = await aggregate(appCfg.nginx_log, { fromOffset: off });
  nginxOffsets.set(slug, agg.nextOffset);
  nginxAggCache.set(slug, { agg, until: Date.now() + NGINX_AGG_TTL_MS });
  return agg;
}

const KINDS = {
  users_total: ({ pool }) => pgUsers.total(pool),
  signups_timeseries: ({ pool, params }) => pgUsers.timeseries(pool, params),
  dau: ({ pool }) => pgActivity.dau(pool),
  active_timeseries: ({ pool, params }) => pgActivity.timeseries(pool, params),
  health: ({ appCfg }) => checkHealth(appCfg.health_url),
  pm2: async ({ appCfg }) =>
    (await pm2Snapshot())[appCfg.pm2_name] || { status: "unknown" },
  http_rate: async ({ appCfg }) => (await getNginxAgg(appCfg)).count,
  http_errors: async ({ appCfg }) => (await getNginxAgg(appCfg)).errors,
  http_latency: async ({ appCfg }) => (await getNginxAgg(appCfg)).p95_ms,
  kpi: ({ pool, appCfg, params }) => {
    const kpi = (appCfg.kpis || []).find((k) => k.key === params.key);
    if (!kpi) throw new Error("unknown_kpi");
    return runKpi(pool, kpi);
  },
  kpi_timeseries: async ({ params, appCfg }) => {
    const slug = appCfg.slug;
    const days = { "7d": 7, "30d": 30, "90d": 90 }[params.range] || 30;
    const { rows } = await dbPool.query(
      `WITH days AS (
         SELECT generate_series(date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day',
                                date_trunc('day', NOW()), INTERVAL '1 day') AS d
       )
       SELECT to_char(days.d, 'YYYY-MM-DD') AS t,
              AVG(ms.value)::float8 AS value
         FROM days
         LEFT JOIN metric_samples ms
           ON ms.app_slug = $2 AND ms.metric = 'kpi:' || $3
          AND ms.taken_at >= days.d AND ms.taken_at < days.d + INTERVAL '1 day'
        GROUP BY days.d ORDER BY days.d`,
      [days, slug, params.key],
    );
    return rows;
  },
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
