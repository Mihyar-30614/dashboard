import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../auth/session.js";
import { KIND_INDEX } from "../widgets/registry.js";
import { loadApps, validScreens } from "../config.js";
import { defaultBoard } from "../widgets/boards.js";

const router = Router();
router.use(requireAuth);

function validateLayout(arr) {
  if (!Array.isArray(arr)) return "not_array";
  for (const w of arr) {
    if (!w.id || !w.kind || !KIND_INDEX[w.kind]) return "bad_widget";
    if (![w.x, w.y, w.w, w.h].every(Number.isInteger)) return "bad_geometry";
  }
  return null;
}

function defaultLayout(screen) {
  return defaultBoard(screen, Object.keys(loadApps()));
}

router.get("/:screen", async (req, res) => {
  const screen = req.params.screen;
  if (!validScreens().has(screen))
    return res.status(400).json({ error: "bad_screen" });
  const { rows } = await query(
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
  if (!validScreens().has(screen))
    return res.status(400).json({ error: "bad_screen" });
  const reason = validateLayout(req.body?.layout);
  if (reason) return res.status(400).json({ error: reason });

  const { rows } = await query(
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
