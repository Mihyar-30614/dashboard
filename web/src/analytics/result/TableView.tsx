import { useMemo, useState } from "react";
import { formatCell } from "../../lib/format";

type Row = Record<string, unknown>;
type SortDir = "asc" | "desc" | null;

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export default function TableView({ rows }: { rows: Row[] }) {
  const cols = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows.slice(0, 50)) for (const k of Object.keys(r)) set.add(k);
    return Array.from(set);
  }, [rows]);

  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const view = useMemo(() => {
    const base = rows.slice(0, 200);
    if (!sortCol || sortDir === null) return base;
    const sorted = [...base].sort((a, b) => compare(a[sortCol], b[sortCol]));
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [rows, sortCol, sortDir]);

  function clickHeader(c: string) {
    if (sortCol !== c) {
      setSortCol(c);
      setSortDir("asc");
    } else if (sortDir === "asc") setSortDir("desc");
    else if (sortDir === "desc") {
      setSortCol(null);
      setSortDir(null);
    } else setSortDir("asc");
  }

  if (rows.length === 0) {
    return <div className="an-result__placeholder">(no rows)</div>;
  }

  if (rows.length === 1 && cols.length === 1) {
    const v = rows[0][cols[0]];
    return (
      <div className="an-result__metric">
        <span className="eyebrow">{cols[0]}</span>
        <span className="metric metric--xl">{formatCell(v)}</span>
      </div>
    );
  }

  return (
    <table className="an-table">
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c} onClick={() => clickHeader(c)} title="Click to sort">
              {c}
              {sortCol === c && sortDir && (
                <span className="an-table__sort">
                  {sortDir === "asc" ? "▲" : "▼"}
                </span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {view.map((r, i) => (
          <tr key={i}>
            {cols.map((c) => (
              <td key={c}>{formatCell(r[c])}</td>
            ))}
          </tr>
        ))}
      </tbody>
      {rows.length > 200 && (
        <tfoot>
          <tr>
            <td
              colSpan={cols.length}
              style={{
                padding: "8px 12px",
                color: "var(--muted)",
                fontSize: 11,
              }}
            >
              showing 200 of {rows.length}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
