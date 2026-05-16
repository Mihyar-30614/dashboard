const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

async function activeWithin(pool, interval) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT user_id)::int AS n
       FROM refresh_tokens
      WHERE last_used_at > NOW() - $1::interval`,
    [interval]
  );
  return rows[0].n;
}

export const dau = pool => activeWithin(pool, '1 day');
export const wau = pool => activeWithin(pool, '7 days');
export const mau = pool => activeWithin(pool, '30 days');

export async function timeseries(pool, { range = '30d' } = {}) {
  const days = RANGE_DAYS[range] ?? 30;
  const { rows } = await pool.query(
    `WITH days AS (
       SELECT generate_series(
         date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day',
         date_trunc('day', NOW()),
         INTERVAL '1 day'
       ) AS d
     )
     SELECT to_char(days.d, 'YYYY-MM-DD') AS t,
            COUNT(DISTINCT rt.user_id)::int AS value
       FROM days
       LEFT JOIN refresh_tokens rt
         ON rt.last_used_at >= days.d
        AND rt.last_used_at <  days.d + INTERVAL '1 day'
      GROUP BY days.d
      ORDER BY days.d`,
    [days]
  );
  return rows;
}
