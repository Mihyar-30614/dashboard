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
import { isDateValue, isNumericValue } from "../format";

type Row = Record<string, unknown>;

type PickResult =
  | { ok: true; kind: "bar" | "line"; xKey: string; yKey: string }
  | { ok: false; reason: string };

function colIsNumeric(rows: Row[], col: string): boolean {
  let seen = 0;
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    if (!isNumericValue(v)) return false;
    seen++;
  }
  return seen > 0;
}

function colIsDate(rows: Row[], col: string): boolean {
  let seen = 0;
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    if (!isDateValue(v)) return false;
    seen++;
  }
  return seen > 0;
}

function colIsCategorical(rows: Row[], col: string): boolean {
  let seen = 0;
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    if (typeof v !== "string") return false;
    if (isDateValue(v)) return false;
    if (isNumericValue(v)) return false;
    seen++;
  }
  return seen > 0;
}

function choosePick(rows: Row[]): PickResult {
  if (rows.length === 0) return { ok: false, reason: "no rows to chart" };

  const cols = Array.from(
    rows.reduce<Set<string>>((s, r) => {
      for (const k of Object.keys(r)) s.add(k);
      return s;
    }, new Set()),
  );

  if (cols.length < 2) {
    return { ok: false, reason: "single-column result — no axis pair" };
  }

  const numericCols = cols.filter((c) => colIsNumeric(rows, c));
  const dateCols = cols.filter((c) => colIsDate(rows, c));
  const categoricalCols = cols.filter((c) => colIsCategorical(rows, c));

  if (numericCols.length === 0) {
    return { ok: false, reason: "no numeric column to plot" };
  }

  if (dateCols.length > 0) {
    const yKey = numericCols.find((c) => !dateCols.includes(c)) ?? numericCols[0];
    return { ok: true, kind: "line", xKey: dateCols[0], yKey };
  }

  if (categoricalCols.length > 0) {
    const yKey = numericCols.find((c) => !categoricalCols.includes(c)) ?? numericCols[0];
    return { ok: true, kind: "bar", xKey: categoricalCols[0], yKey };
  }

  if (cols.length === 2 && numericCols.length === 1) {
    const xKey = cols.find((c) => c !== numericCols[0])!;
    return { ok: true, kind: "bar", xKey, yKey: numericCols[0] };
  }

  return {
    ok: false,
    reason: "no categorical or time column to use as an axis",
  };
}

function coerce(rows: Row[], xKey: string, yKey: string): Row[] {
  return rows.map((r) => {
    const yv = r[yKey];
    const y = typeof yv === "string" && isNumericValue(yv) ? Number(yv) : yv;
    return { ...r, [yKey]: y, [xKey]: r[xKey] };
  });
}

export default function ChartView({
  rows,
  fallback,
}: {
  rows: Row[];
  fallback: React.ReactNode;
}) {
  const pick = useMemo(() => choosePick(rows), [rows]);

  if (!pick.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--muted)",
            padding: "6px 10px",
            border: "1px dashed var(--rule)",
            borderRadius: 6,
          }}
        >
          chart unavailable · {pick.reason}
        </div>
        {fallback}
      </div>
    );
  }

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

  const data = coerce(
    pick.kind === "bar" ? rows.slice(0, 200) : rows.slice(0, 500),
    pick.xKey,
    pick.yKey,
  );

  return (
    <ResponsiveContainer width="100%" height={300}>
      {pick.kind === "bar" ? (
        <BarChart data={data}>
          <CartesianGrid stroke={rule} strokeDasharray="3 3" />
          <XAxis dataKey={pick.xKey} stroke={rule} />
          <YAxis stroke={rule} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey={pick.yKey} fill={accent} />
        </BarChart>
      ) : (
        <LineChart data={data}>
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
