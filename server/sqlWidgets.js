export const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };
const MAX_SQL_BYTES = 16 * 1024;
const STATEMENT_TIMEOUT_MS = 5_000;
export const MAX_ROWS = 1000;

export function rewriteSql(sql, range) {
  if (Buffer.byteLength(sql, 'utf8') > MAX_SQL_BYTES) {
    throw new Error('sql_too_large');
  }
  // Reject multi-statement: a ';' followed by any non-whitespace.
  if (/;\s*\S/.test(sql)) {
    throw new Error('bad_sql');
  }
  const days = RANGE_DAYS[range] ?? 30;

  // Reject unknown :word tokens (other than :range_days). A '::' cast is not a param.
  const tokens = [...sql.matchAll(/(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g)].map(m => m[1]);
  for (const t of tokens) {
    if (t !== 'range_days') throw new Error('unknown_param:' + t);
  }
  const text = sql.replace(/(?<!:):range_days\b/g, '$1');
  const values = tokens.includes('range_days') ? [days] : [];
  return { text, days, values };
}

export function inferViz({ columns, rows }) {
  if (columns.length === 0 || rows.length === 0) return 'table';
  const sample = rows[0];

  if (rows.length === 1 && columns.length === 1) {
    const v = sample[columns[0]];
    if (typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)))) {
      return 'number';
    }
  }

  if (columns[0] === 't' && columns.length >= 2) {
    return 'line';
  }

  if (columns.length === 2 && typeof sample[columns[1]] === 'number') {
    return 'bar';
  }

  return 'table';
}

export async function executeSqlWidget(pool, sql, range) {
  const { text, values } = rewriteSql(sql, range);
  const start = Date.now();
  const client = await pool.connect();
  try {
    await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    await client.query('SET default_transaction_read_only = on');
    await client.query('BEGIN READ ONLY');
    let result;
    try {
      result = values.length ? await client.query(text, values) : await client.query(text);
      await client.query('ROLLBACK');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      throw err;
    }
    const truncated = result.rows.length > MAX_ROWS;
    const rows = truncated ? result.rows.slice(0, MAX_ROWS) : result.rows;
    return {
      columns: result.fields.map(f => f.name),
      rows,
      truncated,
      durationMs: Date.now() - start,
    };
  } finally {
    client.release();
  }
}
