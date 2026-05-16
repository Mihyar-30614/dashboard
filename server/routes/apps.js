import { Router } from "express";
import { loadApps } from "../config.js";
import { requireAuth } from "../auth/session.js";
import { snapshot as pm2Snapshot } from "../collectors/pm2.js";
import { checkHealth } from "../collectors/health.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const apps = loadApps();
  let pm2 = {};
  try {
    pm2 = await pm2Snapshot();
  } catch {
    pm2 = {};
  }

  const out = await Promise.all(
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
  res.json(out);
});

export default router;
