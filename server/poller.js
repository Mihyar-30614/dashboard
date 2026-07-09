import { query } from "./db.js";
import { loadApps } from "./config.js";
import { getAppPool } from "./appPools.js";
import * as pgUsers from "./collectors/pgUsers.js";
import * as pgActivity from "./collectors/pgActivity.js";
import { runKpi } from "./collectors/pgKpi.js";
import { snapshot as pm2Snapshot } from "./collectors/pm2.js";
import { checkHealth } from "./collectors/health.js";
import { handleHealthSample } from "./alerts.js";

const TICK_MS = 30_000;
const TRIM_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TRIM_INITIAL_DELAY_MS = 5 * 60 * 1000;
const SAMPLE_RETENTION_DAYS = 90;

let timer;
let lastTick = { startedAt: null, ms: null, errors: [] };

async function persistSample(slug, metric, value) {
  if (!Number.isFinite(value)) return;
  await query(
    `INSERT INTO metric_samples(app_slug, metric, value) VALUES ($1,$2,$3)`,
    [slug, metric, value],
  );
}

async function pollApp(app) {
  const errors = [];
  const pool = getAppPool(app.slug);

  await Promise.allSettled([
    pgUsers
      .total(pool, app)
      .then((v) => persistSample(app.slug, "users_total", v))
      .catch((e) => errors.push({ k: "users_total", m: e.message })),
    pgActivity
      .dau(pool, app)
      .then((v) => persistSample(app.slug, "dau", v))
      .catch((e) => errors.push({ k: "dau", m: e.message })),
    checkHealth(app.health_url)
      .then(async (h) => {
        await persistSample(app.slug, "health_ok", h.ok ? 1 : 0);
        await handleHealthSample(app.slug, h.ok);
      })
      .catch((e) => errors.push({ k: "health", m: e.message })),
    ...(app.kpis || []).map((kpi) =>
      runKpi(pool, kpi)
        .then((v) => persistSample(app.slug, "kpi:" + kpi.key, v))
        .catch((e) => errors.push({ k: "kpi:" + kpi.key, m: e.message })),
    ),
  ]);

  return errors;
}

export async function runTick() {
  const startedAt = Date.now();
  const errors = [];
  try {
    await pm2Snapshot();
  } catch (e) {
    errors.push({ k: "pm2", m: e.message });
  }

  const apps = Object.values(loadApps());
  const results = await Promise.allSettled(apps.map((a) => pollApp(a)));
  for (const r of results) if (r.status === "fulfilled") errors.push(...r.value);

  lastTick = { startedAt, ms: Date.now() - startedAt, errors };
  if (lastTick.ms > 5_000) console.warn("poller_slow", lastTick);
  return lastTick;
}

async function trimOld() {
  await query(
    `DELETE FROM metric_samples WHERE taken_at < NOW() - INTERVAL '${SAMPLE_RETENTION_DAYS} days'`,
  );
}

export function startPoller() {
  if (timer) return;
  runTick();
  timer = setInterval(runTick, TICK_MS);
  setTimeout(function tick() {
    trimOld().catch((e) => console.error("trim_failed", e));
    setTimeout(tick, TRIM_INTERVAL_MS);
  }, TRIM_INITIAL_DELAY_MS);
}

export function getLastTick() {
  return lastTick;
}
