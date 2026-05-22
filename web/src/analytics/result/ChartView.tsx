import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = Record<string, unknown>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function isNumeric(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isDateLike(v: unknown): boolean {
  if (v instanceof Date) return true;
  return typeof v === "string" && DATE_RE.test(v);
}

type Pick =
  | { kind: "bar"; xKey: string; yKey: string }
  | { kind: "line"; xKey: string; yKey: string }
  | null;

function choosePick(rows: Row[]): Pick {
  if (rows.length === 0) return null;
  const cols = Object.keys(rows[0] ?? {});
  if (cols.length < 2) return null;

  const numericCols = cols.filter((c) =>
    rows.every((r) => r[c] === null || r[c] === undefined || isNumeric(r[c])),
  );
  const dateCols = cols.filter((c) =>
    rows.every(
      (r) => r[c] === null || r[c] === undefined || isDateLike(r[c]),
    ),
  );

  if (dateCols.length > 0 && numericCols.length > 0) {
    return { kind: "line", xKey: dateCols[0], yKey: numericCols[0] };
  }
  if (cols.length === 2 && numericCols.length === 1) {
    const xKey = cols.find((c) => c !== numericCols[0])!;
    return { kind: "bar", xKey, yKey: numericCols[0] };
  }
  return null;
}

export default function ChartView({
  rows,
  fallback,
}: {
  rows: Row[];
  fallback: React.ReactNode;
}) {
  const pick = useMemo(() => choosePick(rows), [rows]);

  if (rows.length === 0) {
    return <div className="an-result__placeholder">(no rows)</div>;
  }
  if (!pick) return <>{fallback}</>;

  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue("--chart-1")
    .trim() || "#0f6b66";
  const rule = getComputedStyle(document.documentElement)
    .getPropertyValue("--rule")
    .trim() || "#d9d4c5";
  const panel = getComputedStyle(document.documentElement)
    .getPropertyValue("--panel")
    .trim() || "#fffcf5";

  const tooltipStyle = {
    background: panel,
    border: `1px solid ${rule}`,
    fontFamily: "var(--font-mono)",
    fontSize: 12,
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      {pick.kind === "bar" ? (
        <BarChart data={rows.slice(0, 200)}>
          <CartesianGrid stroke={rule} strokeDasharray="3 3" />
          <XAxis dataKey={pick.xKey} stroke={rule} />
          <YAxis stroke={rule} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey={pick.yKey} fill={accent} />
        </BarChart>
      ) : (
        <LineChart data={rows.slice(0, 500)}>
          <CartesianGrid stroke={rule} strokeDasharray="3 3" />
          <XAxis dataKey={pick.xKey} stroke={rule} />
          <YAxis stroke={rule} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone"
            dataKey={pick.yKey}
            stroke={accent}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}
