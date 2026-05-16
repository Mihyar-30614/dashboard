const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 };

export async function total(pool, appCfg = {}) {
  const sql =
    appCfg.queries?.users_total || "SELECT COUNT(*)::int AS value FROM users";
  const { rows } = await pool.query(sql);
  return Number(rows[0]?.value ?? rows[0]?.n ?? 0);
}

export async function timeseries(pool, { range = "30d" } = {}, appCfg = {}) {
  const days = RANGE_DAYS[range] ?? 30;
  const sql =
    appCfg.queries?.signups_timeseries ||
    `WITH days AS (
       SELECT generate_series(
         date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day',
         date_trunc('day', NOW()),
         INTERVAL '1 day'
       ) AS d
     )
     SELECT to_char(days.d, 'YYYY-MM-DD') AS t,
            COALESCE(COUNT(u.id), 0)::int AS value
       FROM days
       LEFT JOIN users u
         ON date_trunc('day', u.created_at) = days.d
      GROUP BY days.d
      ORDER BY days.d`;
  const { rows } = await pool.query(sql, [days]);
  return rows;
}
