// Shopping items carry a line price (quantity is almost always 1) and the
// date they were ticked off in bought_at. Receipt scans add tax lines as
// items; they count toward spend but are not "products" for price tracking.
const SPEND = `status = 'done' AND price IS NOT NULL AND bought_at IS NOT NULL`;

export async function spend(pool) {
  const [{ rows: [t] }, { rows: cats }] = await Promise.all([
    pool.query(
      `SELECT
         COALESCE(SUM(price) FILTER (WHERE bought_at >= date_trunc('month', NOW())), 0)::float8 AS mtd,
         COALESCE(SUM(price) FILTER (WHERE bought_at >= date_trunc('month', NOW()) - INTERVAL '1 month'
                                       AND bought_at < NOW() - INTERVAL '1 month'), 0)::float8 AS last_month_same_day,
         COALESCE(SUM(price) FILTER (WHERE bought_at >= date_trunc('month', NOW()) - INTERVAL '1 month'
                                       AND bought_at < date_trunc('month', NOW())), 0)::float8 AS last_month,
         (COALESCE(SUM(price) FILTER (WHERE bought_at >= date_trunc('month', NOW()) - INTERVAL '3 months'
                                        AND bought_at < date_trunc('month', NOW())), 0) / 3.0)::float8 AS avg_3m,
         COUNT(*) FILTER (WHERE bought_at >= date_trunc('month', NOW()))::int AS items_mtd
         FROM shopping_items WHERE ${SPEND}`,
    ),
    pool.query(
      `SELECT COALESCE(category, 'Other') AS category,
              SUM(price) FILTER (WHERE bought_at >= date_trunc('month', NOW()))::float8 AS mtd,
              (SUM(price) FILTER (WHERE bought_at < date_trunc('month', NOW())) / 3.0)::float8 AS avg_3m
         FROM shopping_items
        WHERE ${SPEND} AND bought_at >= date_trunc('month', NOW()) - INTERVAL '3 months'
        GROUP BY 1 ORDER BY 2 DESC NULLS LAST`,
    ),
  ]);
  return {
    currency: "CAD",
    ...t,
    categories: cats.map((c) => ({ ...c, mtd: c.mtd || 0, avg_3m: c.avg_3m || 0 })),
  };
}

// Receipt lines that aren't products, or whose "price" isn't comparable.
const NOT_PRODUCTS = `lower(name) !~ '(tax|hst|gst|pst|deposit|discount|coupon|bag fee|fee$)'`;

export async function priceCreep(pool) {
  // Compare the average of the first two buys with the last two, so one odd
  // receipt doesn't swing the result. Changes beyond +150% / -60% are almost
  // always a different size or brand under the same name, so they're dropped.
  const { rows } = await pool.query(
    `WITH buys AS (
       SELECT lower(trim(name)) AS key, name, bought_at,
              price / GREATEST(COALESCE(quantity, 1), 1) AS unit
         FROM shopping_items
        WHERE ${SPEND} AND price > 0 AND COALESCE(category, '') <> 'Tax' AND ${NOT_PRODUCTS}
          AND bought_at > NOW() - INTERVAL '18 months'
     ), ranked AS (
       SELECT key, name, unit, bought_at,
              ROW_NUMBER() OVER (PARTITION BY key ORDER BY bought_at) AS first_rank,
              ROW_NUMBER() OVER (PARTITION BY key ORDER BY bought_at DESC) AS last_rank,
              COUNT(*) OVER (PARTITION BY key) AS n
         FROM buys
     )
     SELECT MAX(name) FILTER (WHERE last_rank = 1) AS name,
            AVG(unit) FILTER (WHERE first_rank <= 2)::float8 AS first_price,
            AVG(unit) FILTER (WHERE last_rank <= 2)::float8 AS last_price,
            to_char(MIN(bought_at), 'YYYY-MM-DD') AS first_at,
            to_char(MAX(bought_at), 'YYYY-MM-DD') AS last_at,
            MAX(n)::int AS times
       FROM ranked WHERE n >= 4
      GROUP BY key`,
  );
  const items = rows
    .map((r) => ({ ...r, change_pct: ((r.last_price - r.first_price) / r.first_price) * 100 }))
    .filter((r) => Math.abs(r.change_pct) >= 1 && r.change_pct <= 150 && r.change_pct >= -60)
    .sort((a, b) => b.change_pct - a.change_pct);
  return { currency: "CAD", tracked: rows.length, items };
}

export async function todoFlow(pool) {
  const [{ rows: weeks }, { rows: [t] }] = await Promise.all([
    pool.query(
      `WITH weeks AS (
         SELECT generate_series(date_trunc('week', NOW()) - INTERVAL '7 weeks',
                                date_trunc('week', NOW()), INTERVAL '1 week') AS w
       )
       SELECT to_char(w, 'YYYY-MM-DD') AS week,
              (SELECT COUNT(*) FROM todos WHERE created_at >= w AND created_at < w + INTERVAL '1 week')::int AS created,
              (SELECT COUNT(*) FROM todos WHERE completed AND completed_at >= w AND completed_at < w + INTERVAL '1 week')::int AS completed
         FROM weeks ORDER BY w`,
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE NOT t.completed)::int AS open,
              COUNT(*) FILTER (WHERE NOT t.completed AND t.due_at < NOW())::int AS overdue,
              COUNT(*) FILTER (WHERE NOT t.completed AND t.due_at >= NOW() AND t.due_at < NOW() + INTERVAL '7 days')::int AS due_week,
              COUNT(*) FILTER (WHERE NOT t.completed AND t.priority = 'high')::int AS open_high,
              (PERCENTILE_CONT(0.5) WITHIN GROUP (
                 ORDER BY EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 86400
               ) FILTER (WHERE t.completed AND t.completed_at > NOW() - INTERVAL '90 days'))::float8 AS median_days
         FROM todos t
         JOIN projects p ON p.id = t.project_id
        WHERE NOT t.archived AND NOT p.archived AND p.deleted_at IS NULL`,
    ),
  ]);
  return { ...t, weeks };
}

export async function jobs(pool) {
  const { rows: [r] } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE status <> 'sent' AND created_at < NOW() - INTERVAL '15 minutes')::int AS stuck,
            MAX(sent_at) AS last_at
       FROM notification_outbox`,
  );
  return { label: "notifications stuck", value: r.stuck, last_at: r.last_at, attention: r.stuck };
}
