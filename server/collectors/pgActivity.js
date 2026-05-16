const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 };

export async function dau(pool, appCfg = {}) {
  const sql = appCfg.queries?.dau;
  if (!sql) throw new Error("dau_not_configured");
  const { rows } = await pool.query(sql);
  return Number(rows[0]?.value ?? rows[0]?.n ?? 0);
}

export async function timeseries(pool, { range = "30d" } = {}, appCfg = {}) {
  const days = RANGE_DAYS[range] ?? 30;
  const sql = appCfg.queries?.active_timeseries;
  if (!sql) throw new Error("active_timeseries_not_configured");
  const { rows } = await pool.query(sql, [days]);
  return rows;
}
