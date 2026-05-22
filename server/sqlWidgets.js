export const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };
export const MAX_SQL_BYTES = 16 * 1024;
export const STATEMENT_TIMEOUT_MS = 5_000;
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

  // Reject unknown :word tokens (other than :range_days).
  const tokens = [...sql.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)].map(m => m[1]);
  for (const t of tokens) {
    if (t !== 'range_days') throw new Error('unknown_param:' + t);
  }
  const text = sql.replace(/:range_days\b/g, '$1');
  return { text, days };
}
