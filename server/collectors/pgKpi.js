const TIMEOUT_MS = 5_000;

export async function runKpi(pool, { sql }) {
  const client = await pool.connect();
  try {
    await client.query(`SET statement_timeout = ${TIMEOUT_MS}`);
    const { rows } = await client.query(sql);
    if (!rows[0] || !("value" in rows[0])) throw new Error("kpi_no_value");
    const n = Number(rows[0].value);
    if (!Number.isFinite(n)) throw new Error("kpi_not_numeric");
    return n;
  } finally {
    client.release();
  }
}
