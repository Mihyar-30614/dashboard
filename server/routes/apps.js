import { Router } from "express";
import { loadApps } from "../config.js";
import { requireAuth } from "../auth/session.js";
import { snapshot as pm2Snapshot } from "../collectors/pm2.js";
import { checkHealth } from "../collectors/health.js";
import { appsCache } from "../cache.js";

const router = Router();
router.use(requireAuth);

const APPS_TTL_MS = 30_000;
const CACHE_KEY = "apps:list";

async function fetchAppsList() {
  const apps = loadApps();
  let pm2 = {};
  try {
    pm2 = await pm2Snapshot();
  } catch {
    pm2 = {};
  }

  return Promise.all(
    Object.values(apps).map(async (a) => {
      const pm = pm2[a.pm2_name] || { status: "unknown" };
      const health = await checkHealth(a.health_url);
      return {
        slug: a.slug,
        label: a.label,
        pm2_name: a.pm2_name,
        pm2_status: pm.status,
        pm2_cpu: pm.cpu,
        pm2_mem_bytes: pm.mem_bytes,
        health,
      };
    }),
  );
}

router.get("/", async (_req, res) => {
  const cached = appsCache.get(CACHE_KEY);
  if (cached) return res.json(cached);

  const out = await fetchAppsList();
  appsCache.set(CACHE_KEY, out, APPS_TTL_MS);
  res.json(out);
});

export default router;
