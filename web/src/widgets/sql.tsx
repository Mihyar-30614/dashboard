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
import WidgetFrame from "../grid/WidgetFrame";
import Skeleton from "../grid/Skeleton";
import { useSqlWidget, useSqlRun, type SqlRunResult } from "../api/sqlWidgets";
import { formatCell } from "../lib/format";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export function SqlNumber({
  result,
  options = {},
}: {
  result: SqlRunResult;
  options?: { unit?: string; decimals?: number };
}) {
  const col = result.columns[0];
  const row = result.rows[0];
  if (!col || !row) {
    return <div className="metric metric--lg">—</div>;
  }
  const raw = row[col];
  const num = typeof raw === "number" ? raw : Number(raw);
  const formatted =
    typeof options.decimals === "number" && Number.isFinite(num)
      ? num.toFixed(options.decimals)
      : String(raw);
  return (
    <div className="metric metric--lg">
      {formatted}
      {options.unit ?? ""}
    </div>
  );
}

export function SqlLine({
  result,
  options,
}: {
  result: SqlRunResult;
  options?: { xCol?: string; yCol?: string | string[] };
}) {
  const xCol = options?.xCol ?? result.columns[0] ?? "x";
  const yCols = Array.isArray(options?.yCol)
    ? options.yCol
    : options?.yCol
      ? [options.yCol]
      : result.columns.filter((c) => c !== xCol);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={result.rows}>
        <CartesianGrid stroke="var(--grid-line)" />
        <XAxis dataKey={xCol} tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        {yCols.map((y, i) => (
          <Line
            key={y}
            type="monotone"
            dataKey={y}
            stroke={COLORS[i % COLORS.length]}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SqlBar({
  result,
  options,
}: {
  result: SqlRunResult;
  options?: { xCol?: string; yCol?: string | string[] };
}) {
  const xCol = options?.xCol ?? result.columns[0] ?? "x";
  const yCols = Array.isArray(options?.yCol)
    ? options.yCol
    : options?.yCol
      ? [options.yCol]
      : result.columns.filter((c) => c !== xCol);

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

export function SqlTable({
  result,
  options,
}: {
  result: SqlRunResult;
  options?: { columns?: string[] };
}) {
  const cols = options?.columns?.length
    ? options.columns.filter((c) => result.columns.includes(c))
    : result.columns;

  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      {result.truncated && (
        <div className="data-table__note">truncated to 1000 rows</div>
      )}
      <table className="data-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c}>{formatCell(row[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Params = { widget_id?: number; range?: string };

function renderViz(viz: string, result: SqlRunResult, options: any) {
  switch (viz) {
    case "number":
      return <SqlNumber result={result} options={options} />;
    case "line":
      return <SqlLine result={result} options={options} />;
    case "bar":
      return <SqlBar result={result} options={options} />;
    case "table":
    default:
      return <SqlTable result={result} options={options} />;
  }
}

export default function SqlWidget({
  widgetId,
  params = {},
  onRemove,
}: {
  app?: string;
  widgetId?: number;
  params?: Params;
  onRemove?: () => void;
}) {
  const id = widgetId ?? Number(params.widget_id);
  const range = params.range || "30d";
  const meta = useSqlWidget(id);
  const run = useSqlRun(id, range);

  if (meta.isLoading || run.isLoading) {
    return (
      <WidgetFrame title="sql" onRemove={onRemove}>
        <div data-testid="widget-skeleton">
          <Skeleton variant="block" />
        </div>
      </WidgetFrame>
    );
  }

  if ((meta.error as any)?.status === 404 || !meta.data) {
    return (
      <WidgetFrame title="sql · deleted" onRemove={onRemove}>
        <div className="widget-empty">Widget deleted</div>
      </WidgetFrame>
    );
  }

  const widget = meta.data;
  const error = run.data?.error;
  const result = run.data?.data;

  return (
    <WidgetFrame
      title={widget.name}
      meta={widget.data_source}
      onRemove={onRemove}
      error={error}
    >
      {result ? renderViz(widget.viz, result, widget.options) : null}
    </WidgetFrame>
  );
}
