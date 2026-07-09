import { Router } from "express";
import { requireAuth, requireAdmin } from "../auth/session.js";
import { listDataSources, getReadOnlyPool } from "../dataSources.js";
import { executeSqlWidget, inferViz } from "../sqlWidgets.js";
import { query } from "../db.js";
import { metricsCache } from "../cache.js";

const router = Router();
router.use(requireAuth);

const RUN_TTL_MS = 30_000;
const RUN_ERR_TTL_MS = 10_000;
const VALID_VIZ = new Set(["number", "line", "bar", "table"]);

function safeErrorMessage(err) {
  const msg = err.message || "execution_error";
  if (msg.startsWith("unknown_param:")) return msg;
  if (["bad_sql", "sql_too_large", "unknown_data_source"].includes(msg)) return msg;
  if (err.code === "42501" || /read-only/i.test(msg)) return "read_only_violation";
  if (err.code === "57014") return "timeout";
  return msg.replace(/[\r\n]+/g, " ").slice(0, 200);
}

function validateBody(body) {
  if (!body || typeof body !== "object") return "bad_request";
  if (typeof body.name !== "string" || !body.name.trim()) return "bad_request";
  if (typeof body.data_source !== "string") return "bad_request";
  if (typeof body.sql !== "string") return "bad_request";
  if (!VALID_VIZ.has(body.viz)) return "bad_viz";
  return null;
}

// /sources must be registered before /:id to avoid param collision
router.get("/sources", (_req, res) => {
  res.json(listDataSources());
});

// /schema must be before /:id
router.get("/schema", requireAdmin, async (req, res) => {
  const dataSource = String(req.query.data_source || "");
  const sources = listDataSources();
  if (!sources.some(s => s.name === dataSource)) {
    return res.status(400).json({ error: "unknown_data_source" });
  }
  try {
    const pool = getReadOnlyPool(dataSource);
    const { rows } = await pool.query(
      `SELECT table_name, column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position`
    );
    const schemas = {};
    for (const r of rows) {
      (schemas[r.table_name] ??= []).push({
        name: r.column_name,
        type: r.data_type,
        nullable: r.is_nullable === "YES",
      });
    }
    res.json({ db_name: dataSource, tables: Object.keys(schemas), schemas });
  } catch (err) {
    res.status(400).json({ error: safeErrorMessage(err) });
  }
});

// /preview must be before /:id
router.post("/preview", requireAdmin, async (req, res) => {
  const { data_source, sql, range } = req.body || {};
  if (typeof data_source !== "string" || typeof sql !== "string") {
    return res.status(400).json({ error: "bad_request" });
  }
  const sources = listDataSources();
  if (!sources.some(s => s.name === data_source)) {
    return res.status(400).json({ error: "unknown_data_source" });
  }
  try {
    const pool = getReadOnlyPool(data_source);
    const result = await executeSqlWidget(pool, sql, range || "30d");
    const inferred = inferViz(result);
    console.info(
      `sql_widget event=preview actor=${req.user.email} ds=${data_source} ` +
      `rows=${result.rows.length} duration_ms=${result.durationMs}`
    );
    res.json({ ...result, inferred_viz: inferred });
  } catch (err) {
    console.info(
      `sql_widget event=preview actor=${req.user.email} ds=${data_source} error=${err.message}`
    );
    res.status(400).json({ error: safeErrorMessage(err) });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  const reason = validateBody(req.body);
  if (reason) return res.status(400).json({ error: reason });
  const { name, description = null, data_source, sql, viz, options = {} } = req.body;

  const sources = listDataSources();
  if (!sources.some(s => s.name === data_source)) {
    return res.status(400).json({ error: "unknown_data_source" });
  }
  try {
    const pool = getReadOnlyPool(data_source);
    await executeSqlWidget(pool, sql, "30d");
  } catch (err) {
    return res.status(400).json({ error: safeErrorMessage(err) });
  }
  const { rows } = await query(
    `INSERT INTO sql_widgets(name, description, data_source, sql, viz, options, created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, name, description, data_source, sql, viz, options, created_at, updated_at`,
    [name, description, data_source, sql, viz, JSON.stringify(options), req.user.id]
  );
  res.json({ ...rows[0], id: Number(rows[0].id) });
});

router.get("/", async (_req, res) => {
  const { rows } = await query(
    `SELECT id, name, description, data_source, sql, viz, options, created_at, updated_at
       FROM sql_widgets ORDER BY id DESC`
  );
  res.json(rows.map(r => ({ ...r, id: Number(r.id) })));
});

// /:id/run must be before /:id
router.get("/:id/run", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bad_id" });
  const range = String(req.query.range || "30d");
  const cacheKey = `sql:${id}:${range}`;
  const cached = metricsCache.get(cacheKey);
  if (cached) return res.json(cached);

  const { rows } = await query(
    `SELECT data_source, sql FROM sql_widgets WHERE id=$1`, [id]
  );
  if (!rows[0]) return res.status(404).json({ error: "not_found" });

  try {
    const pool = getReadOnlyPool(rows[0].data_source);
    const result = await executeSqlWidget(pool, rows[0].sql, range);
    const envelope = { data: result };
    metricsCache.set(cacheKey, envelope, RUN_TTL_MS);
    console.info(
      `sql_widget event=run actor=${req.user.email} ds=${rows[0].data_source} id=${id} ` +
      `rows=${result.rows.length} duration_ms=${result.durationMs}`
    );
    res.json(envelope);
  } catch (err) {
    const envelope = { error: safeErrorMessage(err) };
    metricsCache.set(cacheKey, envelope, RUN_ERR_TTL_MS);
    res.json(envelope);
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bad_id" });

  const cur = await query(`SELECT * FROM sql_widgets WHERE id=$1`, [id]);
  if (!cur.rows[0]) return res.status(404).json({ error: "not_found" });

  const merged = { ...cur.rows[0], ...req.body };
  const reason = validateBody(merged);
  if (reason) return res.status(400).json({ error: reason });

  const sources = listDataSources();
  if (!sources.some(s => s.name === merged.data_source)) {
    return res.status(400).json({ error: "unknown_data_source" });
  }
  try {
    const pool = getReadOnlyPool(merged.data_source);
    await executeSqlWidget(pool, merged.sql, "30d");
  } catch (err) {
    return res.status(400).json({ error: safeErrorMessage(err) });
  }
  const { rows } = await query(
    `UPDATE sql_widgets
        SET name=$2, description=$3, data_source=$4, sql=$5, viz=$6, options=$7, updated_at=NOW()
      WHERE id=$1
      RETURNING id, name, description, data_source, sql, viz, options, created_at, updated_at`,
    [id, merged.name, merged.description, merged.data_source, merged.sql, merged.viz,
     JSON.stringify(merged.options)]
  );
  res.json({ ...rows[0], id: Number(rows[0].id) });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bad_id" });
  await query(`DELETE FROM sql_widgets WHERE id=$1`, [id]);
  res.json({ ok: true });
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bad_id" });
  const { rows } = await query(
    `SELECT id, name, description, data_source, sql, viz, options, created_at, updated_at
       FROM sql_widgets WHERE id=$1`, [id]
  );
  if (!rows[0]) return res.status(404).json({ error: "not_found" });
  res.json({ ...rows[0], id: Number(rows[0].id) });
});

export default router;
