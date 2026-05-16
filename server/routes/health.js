import { Router } from "express";
import { requireAdmin, requireAuth } from "../auth/session.js";
import { getLastTick } from "../poller.js";
import { metricsCache } from "../cache.js";

const router = Router();

router.get("/", (_req, res) =>
  res.json({ ok: true, uptime_s: process.uptime() }),
);
router.get("/_internal/poller", requireAuth, requireAdmin, (_req, res) => {
  res.json({ lastTick: getLastTick(), cacheSize: metricsCache.size() });
});

export default router;
