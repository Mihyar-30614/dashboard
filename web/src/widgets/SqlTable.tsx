import type { SqlRunResult } from "../api/sqlWidgets";

export default function SqlTable({
  result, options,
}: {
  result: SqlRunResult;
  options?: { columns?: string[] };
}) {
  const cols = options?.columns?.length
    ? options.columns.filter(c => result.columns.includes(c))
    : result.columns;

  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      {result.truncated && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
          truncated to 1000 rows
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ position: "sticky", top: 0, background: "var(--panel)" }}>
          <tr>
            {cols.map(c => (
              <th key={c} style={{ textAlign: "left", padding: "4px 8px",
                                    borderBottom: "1px solid var(--rule)" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i}>
              {cols.map(c => (
                <td key={c} style={{ padding: "4px 8px",
                                     borderBottom: "1px solid var(--rule-faint, var(--rule))" }}>
                  {String(row[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
