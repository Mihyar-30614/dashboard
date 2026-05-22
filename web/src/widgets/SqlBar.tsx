import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { SqlRunResult } from "../api/sqlWidgets";

const COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)", "var(--chart-6)",
];

export default function SqlBar({
  result, options,
}: {
  result: SqlRunResult;
  options?: { xCol?: string; yCol?: string | string[] };
}) {
  const xCol = options?.xCol ?? result.columns[0] ?? "x";
  const yCols = Array.isArray(options?.yCol)
    ? options.yCol
    : options?.yCol
      ? [options.yCol]
      : result.columns.filter(c => c !== xCol);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={result.rows}>
        <CartesianGrid stroke="var(--grid-line)" />
        <XAxis dataKey={xCol} tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        {yCols.map((y, i) => (
          <Bar key={y} dataKey={y} fill={COLORS[i % COLORS.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
