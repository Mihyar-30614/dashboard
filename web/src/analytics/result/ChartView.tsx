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
import { formatDateValue, isDateValue, isNumericValue } from "../../lib/format";

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

  function pickY(exclude: string[]): string {
    const candidates = numericCols.filter((c) => !exclude.includes(c));
    const measures = candidates.filter((c) => !isIdLike(c));
    return measures[0] ?? candidates[0] ?? numericCols[0];
  }

  if (dateCols.length > 0) {
    return { ok: true, kind: "line", xKey: dateCols[0], yKey: pickY(dateCols) };
  }

  if (categoricalCols.length > 0) {
    return {
      ok: true,
      kind: "bar",
      xKey: categoricalCols[0],
      yKey: pickY(categoricalCols),
    };
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

function isIdLike(col: string): boolean {
  const lc = col.toLowerCase();
  if (lc === "id" || lc === "uuid" || lc === "pk") return true;
  if (lc.endsWith("_id")) return true;
  if (/[a-z]Id$/.test(col)) return true; // camelCase: userId, postId
  return false;
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
            border: "1px dashed var(--border)",
            borderRadius: "var(--radius)",
          }}
        >
          chart unavailable · {pick.reason}
        </div>
        {fallback}
      </div>
    );
  }

  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback;

  const accent = v("--chart-1", "#0f6b66");
  const rule = v("--border", "#d9d4c5");
  const panel = v("--panel", "#fffcf5");
  const text = v("--text", "#15171c");
  const muted = v("--muted", "#6c6a62");
  const gridStroke = `color-mix(in srgb, ${muted} 25%, transparent)`;

  const axisTick = { fill: muted, fontFamily: "var(--font-mono)", fontSize: 11 };
  const tooltipStyle = {
    background: panel,
    border: `1px solid ${rule}`,
    borderRadius: "var(--radius)",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    color: text,
    padding: "var(--space-2) 10px",
    boxShadow: "var(--shadow-sm)",
  };
  const tooltipLabel = { color: muted, marginBottom: 4 };
  const tooltipItem = { color: text };
  const tooltipCursor = { fill: `color-mix(in srgb, ${accent} 10%, transparent)` };

  const data = coerce(
    pick.kind === "bar" ? rows.slice(0, 200) : rows.slice(0, 500),
    pick.xKey,
    pick.yKey,
  );

  return (
    <ResponsiveContainer width="100%" height={300}>
      {pick.kind === "bar" ? (
        <BarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={pick.xKey}
            stroke={rule}
            tick={axisTick}
            tickLine={false}
            tickFormatter={(v) => formatDateValue(v) ?? String(v)}
          />
          <YAxis stroke={rule} tick={axisTick} tickLine={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabel}
            itemStyle={tooltipItem}
            cursor={tooltipCursor}
            labelFormatter={(v) => formatDateValue(v) ?? String(v)}
          />
          <Bar dataKey={pick.yKey} fill={accent} radius={[4, 4, 0, 0]} />
        </BarChart>
      ) : (
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={pick.xKey}
            stroke={rule}
            tick={axisTick}
            tickLine={false}
            tickFormatter={(v) => formatDateValue(v) ?? String(v)}
          />
          <YAxis stroke={rule} tick={axisTick} tickLine={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabel}
            itemStyle={tooltipItem}
            cursor={{ stroke: accent, strokeWidth: 1 }}
            labelFormatter={(v) => formatDateValue(v) ?? String(v)}
          />
          <Line
            type="monotone"
            dataKey={pick.yKey}
            stroke={accent}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: accent }}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}
