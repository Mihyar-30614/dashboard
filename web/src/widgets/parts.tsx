import type { ReactNode } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import WidgetFrame from "../grid/WidgetFrame";
import ChartFill from "../grid/ChartFill";
import Skeleton from "../grid/Skeleton";
import { useMetric } from "../api/hooks";

export type WidgetProps = {
  app: string;
  params?: any;
  onRemove?: () => void;
};

export type Tone = "ok" | "warn" | "bad" | "muted" | "accent";

export function useInsight<T>(kind: string, params: Record<string, unknown>) {
  const q = useMetric(kind, params);
  const env = q.data as { data?: T; error?: string } | undefined;
  return {
    data: env?.data,
    error: env?.error ?? (q.error as Error | null)?.message ?? null,
    loading: q.isLoading,
  };
}

/* ---------- formatting ---------- */

export function money(
  cents: number | null | undefined,
  currency = "CAD",
  { compact = false, sign = false }: { compact?: boolean; sign?: boolean } = {},
) {
  if (cents == null || !Number.isFinite(cents)) return "—";
  const v = cents / 100;
  const big = Math.abs(v) >= 1000;
  const s = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    notation: compact && big ? "compact" : "standard",
    maximumFractionDigits: compact || big ? (compact && big ? 1 : 0) : 2,
    minimumFractionDigits: compact || big ? 0 : 2,
    signDisplay: sign ? "exceptZero" : "auto",
  }).format(v);
  return s;
}

export const dollars = (v: number | null | undefined, currency = "CAD", opts = {}) =>
  money(v == null ? v : v * 100, currency, opts);

export function pct(v: number | null | undefined, digits = 0) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-05" → "May 2026"; with short=true → "May". */
export function monthLabel(ym: string, short = false) {
  const [y, m] = ym.split("-").map(Number);
  return short ? MONTHS[m - 1] : `${MONTHS[m - 1]} ${y}`;
}

/** "2026-10-26" → "Oct 26". */
export function dayLabel(ymd: string) {
  const [, m, d] = ymd.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

export function monthsSpan(n: number) {
  const y = Math.floor(n / 12);
  const m = n % 12;
  return [y && `${y}y`, m && `${m}m`].filter(Boolean).join(" ") || "0m";
}

export function ago(ts: string | null | undefined) {
  if (!ts) return "never";
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 129600) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/* ---------- frame ---------- */

export function InsightFrame({
  title,
  meta,
  loading,
  error,
  onRemove,
  children,
}: {
  title: string;
  meta?: string;
  loading: boolean;
  error: string | null;
  onRemove?: () => void;
  children: ReactNode;
}) {
  return (
    <WidgetFrame title={title} titleVariant="label" meta={meta} onRemove={onRemove} error={error}>
      {loading ? <Skeleton variant="chart" /> : children}
    </WidgetFrame>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="ins-empty">{children}</div>;
}

/* ---------- readouts ---------- */

export function Hero({
  value,
  label,
  tone,
  children,
}: {
  value: ReactNode;
  label?: ReactNode;
  tone?: Tone;
  children?: ReactNode;
}) {
  return (
    <div className="ins-hero">
      <div className={`metric ins-hero__value${tone ? ` ins-tone--${tone}` : ""}`}>{value}</div>
      {label && <div className="ins-hero__label">{label}</div>}
      {children}
    </div>
  );
}

export type StatItem = { label: string; value: ReactNode; tone?: Tone; hint?: string };

export function Stats({ items }: { items: StatItem[] }) {
  return (
    <dl className="ins-stats">
      {items.map((s) => (
        <div key={s.label} className="ins-stat" title={s.hint}>
          <dt>{s.label}</dt>
          <dd className={`metric${s.tone ? ` ins-tone--${s.tone}` : ""}`}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pill({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`ins-pill ins-pill--${tone}`}>{children}</span>;
}

export function Note({ tone, children }: { tone?: Tone; children: ReactNode }) {
  return <p className={`ins-note${tone ? ` ins-tone--${tone}` : ""}`}>{children}</p>;
}

export function Meter({
  value,
  max = 100,
  tone = "accent",
  marks = [],
}: {
  value: number;
  max?: number;
  tone?: Tone;
  marks?: number[];
}) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="ins-meter">
      <div className={`ins-meter__fill ins-bg--${tone}`} style={{ width: `${w}%` }} />
      {marks.map((m) => (
        <span key={m} className="ins-meter__mark" style={{ left: `${(m / max) * 100}%` }} />
      ))}
    </div>
  );
}

export type BarRow = {
  key: string;
  label: ReactNode;
  value: number;
  display: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
};

export function BarList({ rows, max }: { rows: BarRow[]; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="ins-bars">
      {rows.map((r) => (
        <li key={r.key} className="ins-bars__row">
          <div className="ins-bars__head">
            <span className="ins-bars__label">{r.label}</span>
            <span className={`metric ins-bars__value${r.tone ? ` ins-tone--${r.tone}` : ""}`}>
              {r.display}
            </span>
          </div>
          <Meter value={Math.abs(r.value)} max={top} tone={r.tone ?? "accent"} />
          {r.sub && <div className="ins-bars__sub">{r.sub}</div>}
        </li>
      ))}
    </ul>
  );
}

/* ---------- charts ---------- */

export type Series = {
  key: string;
  label: string;
  color: string;
  kind: "bar" | "line" | "area";
  stack?: string;
  dashed?: boolean;
};

const axisTick = { fontSize: 10, fill: "var(--muted)" };

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="ins-legend">
      {series.map((s) => (
        <span key={s.key} className="ins-legend__item">
          <span
            className={`ins-legend__swatch${s.kind === "bar" ? "" : " ins-legend__swatch--line"}${s.dashed ? " ins-legend__swatch--dashed" : ""}`}
            style={{ background: s.kind === "bar" ? s.color : undefined, borderColor: s.color }}
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function SeriesChart({
  data,
  xKey,
  series,
  xFormat,
  yFormat,
  tipFormat,
  refs = [],
  legend = true,
}: {
  data: Record<string, any>[];
  xKey: string;
  series: Series[];
  xFormat?: (v: any) => string;
  yFormat?: (v: number) => string;
  tipFormat?: (v: number) => string;
  refs?: { x?: string; y?: number; label?: string; color?: string }[];
  legend?: boolean;
}) {
  return (
    <div className="ins-chart">
      {legend && <Legend series={series} />}
      <ChartFill>
        <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid-line)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={axisTick}
            tickFormatter={xFormat}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            minTickGap={12}
          />
          <YAxis
            tick={axisTick}
            tickFormatter={yFormat}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            labelFormatter={xFormat}
            formatter={(v: number, name: string) => [
              (tipFormat ?? yFormat ?? String)(v),
              series.find((s) => s.key === name)?.label ?? name,
            ]}
            contentStyle={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            cursor={{ fill: "color-mix(in srgb, var(--muted) 10%, transparent)" }}
          />
          {refs.map((r, i) => (
            <ReferenceLine
              key={i}
              x={r.x}
              y={r.y}
              stroke={r.color ?? "var(--muted)"}
              strokeDasharray="3 3"
              label={r.label ? { value: r.label, position: "insideTopLeft", fontSize: 10, fill: "var(--muted)" } : undefined}
            />
          ))}
          {series.map((s) =>
            s.kind === "bar" ? (
              <Bar key={s.key} dataKey={s.key} fill={s.color} stackId={s.stack} radius={s.stack ? 0 : [2, 2, 0, 0]} maxBarSize={28} />
            ) : s.kind === "area" ? (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.14}
                strokeWidth={1.6}
                strokeDasharray={s.dashed ? "4 4" : undefined}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={1.8}
                strokeDasharray={s.dashed ? "4 4" : undefined}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ),
          )}
        </ComposedChart>
      </ChartFill>
    </div>
  );
}
