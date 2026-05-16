import { Router } from "express";
import { dbPool } from "../db.js";
import { requireAuth } from "../auth/session.js";
import { KIND_INDEX } from "../widgets/registry.js";
import { loadApps } from "../config.js";

const router = Router();
router.use(requireAuth);

const VALID_SCREENS = new Set([
  "overview",
  "sportly",
  "honeydoeh",
  "debtmanager",
]);

function validateLayout(arr) {
  if (!Array.isArray(arr)) return "not_array";
  for (const w of arr) {
    if (!w.id || !w.kind || !KIND_INDEX[w.kind]) return "bad_widget";
    if (![w.x, w.y, w.w, w.h].every(Number.isInteger)) return "bad_geometry";
  }
  return null;
}

function defaultLayout(screen) {
  if (screen === "overview") {
    const slugs = Object.keys(loadApps());
    return slugs.flatMap((slug, i) => [
      {
        id: `h_${slug}`,
        kind: "health",
        app: slug,
        x: 0,
        y: i * 2,
        w: 4,
        h: 2,
        params: {},
      },
      {
        id: `p_${slug}`,
        kind: "pm2",
        app: slug,
        x: 4,
        y: i * 2,
        w: 4,
        h: 2,
        params: {},
      },
    ]);
  }
  return [
    {
      id: "d1",
      kind: "users_total",
      app: screen,
      x: 0,
      y: 0,
      w: 2,
      h: 2,
      params: {},
    },
    {
      id: "d2",
      kind: "dau",
      app: screen,
      x: 2,
      y: 0,
      w: 2,
      h: 2,
      params: {},
    },
    {
      id: "d3",
      kind: "signups_timeseries",
      app: screen,
      x: 0,
      y: 2,
      w: 6,
      h: 4,
      params: { range: "30d" },
    },
    {
      id: "d4",
      kind: "active_timeseries",
      app: screen,
      x: 6,
      y: 2,
      w: 6,
      h: 4,
      params: { range: "30d" },
    },
  ];
}

router.get("/:screen", async (req, res) => {
  const screen = req.params.screen;
  if (!VALID_SCREENS.has(screen))
    return res.status(400).json({ error: "bad_screen" });
  const { rows } = await dbPool.query(
    `SELECT layout, updated_at FROM dashboard_layouts WHERE user_id=$1 AND screen=$2`,
    [req.user.id, screen],
  );
  if (rows[0])
    return res.json({
      layout: rows[0].layout,
      updated_at: rows[0].updated_at,
    });
  res.json({ layout: defaultLayout(screen), default: true });
});

router.put("/:screen", async (req, res) => {
  const screen = req.params.screen;
  if (!VALID_SCREENS.has(screen))
    return res.status(400).json({ error: "bad_screen" });
  const reason = validateLayout(req.body?.layout);
  if (reason) return res.status(400).json({ error: reason });

  const { rows } = await dbPool.query(
    `INSERT INTO dashboard_layouts(user_id,screen,layout,updated_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (user_id,screen)
     DO UPDATE SET layout=EXCLUDED.layout, updated_at=NOW()
     RETURNING updated_at`,
    [req.user.id, screen, JSON.stringify(req.body.layout)],
  );
  res.json({ ok: true, updated_at: rows[0].updated_at });
});

export default router;
