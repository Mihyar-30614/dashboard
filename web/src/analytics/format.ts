export function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function csvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const cols: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        cols.push(k);
      }
    }
  }
  const header = cols.join(",");
  const body = rows
    .map((r) => cols.map((c) => csvField(r[c])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
  "ON", "AS", "GROUP", "BY", "ORDER", "LIMIT", "OFFSET", "HAVING",
  "AND", "OR", "NOT", "IN", "IS", "NULL", "TRUE", "FALSE",
  "DISTINCT", "UNION", "ALL", "WITH", "CASE", "WHEN", "THEN", "ELSE", "END",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "ASC", "DESC", "COUNT", "SUM", "AVG", "MIN", "MAX",
]);

export function highlightSql(sql: string): Array<{ text: string; kw: boolean }> {
  const out: Array<{ text: string; kw: boolean }> = [];
  const re = /[A-Za-z_]+|[^A-Za-z_]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const token = m[0];
    const kw = /^[A-Za-z_]+$/.test(token) && SQL_KEYWORDS.has(token.toUpperCase());
    out.push({ text: token, kw });
  }
  return out;
}
