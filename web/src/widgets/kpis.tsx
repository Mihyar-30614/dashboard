import type { ReactNode } from "react";
import { useQueries } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import WidgetFrame from "../grid/WidgetFrame";
import Skeleton from "../grid/Skeleton";
import { useApps, useMetric } from "../api/hooks";
import { api } from "../api/client";

type WidgetProps = {
  app: string;
  params?: any;
  onRemove?: () => void;
};

type KpiTone = "default" | "ok" | "warn" | "bad";

function useKpiLabel(app: string, key?: string) {
  const apps = useApps();
  if (!key) return key ?? "";
  const catalog = (
    apps.data as { slug: string; kpis?: { key: string; label?: string }[] }[] | undefined
  )?.find((a) => a.slug === app)?.kpis;
  return catalog?.find((k) => k.key === key)?.label || key;
}

function formatKpiValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  const asNum = Number(value);
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(asNum)) {
    return asNum.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

function KpiValue({
  value,
  loading,
  tone = "default",
  footer,
  compact,
}: {
  value: unknown;
  loading?: boolean;
  tone?: KpiTone;
  footer?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`kpi-value${compact ? " kpi-value--compact" : ""}`}>
      <div
        className={[
          "kpi-value__hero",
          compact ? "metric metric--lg" : "metric metric--xl",
          tone !== "default" ? `kpi-value__hero--${tone}` : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {loading ? (
          <Skeleton variant="block" width={compact ? 72 : 120} height={compact ? 28 : 40} />
        ) : (
          formatKpiValue(value)
        )}
      </div>
      {footer && <div className="kpi-value__footer">{footer}</div>}
    </div>
  );
}

function KpiWidgetFrame({
  app,
  label,
  onRemove,
  error,
  stale,
  children,
}: {
  app: string;
  label: string;
  onRemove?: () => void;
  error?: string | null;
  stale?: boolean;
  children: ReactNode;
}) {
  return (
    <WidgetFrame
      title={label}
      titleVariant="label"
      meta={app}
      onRemove={onRemove}
      error={error}
      stale={stale}
    >
      <div className="kpi-widget__body">{children}</div>
    </WidgetFrame>
  );
}

export function KpiCard({ app, params = {}, onRemove }: WidgetProps) {
  const q = useMetric("kpi", { app, key: params.key });
  const label = useKpiLabel(app, params.key);

  return (
    <KpiWidgetFrame
      app={app}
      label={label}
      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <KpiValue value={(q.data as any)?.data} loading={q.isLoading} />
    </KpiWidgetFrame>
  );
}

function avg(arr: { value: number | null | undefined }[]): number | null {
  const nums = arr
    .map((p) => (typeof p.value === "number" ? p.value : null))
    .filter((v): v is number => v !== null && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function KpiDelta({ app, params = {}, onRemove }: WidgetProps) {
  const cur = useMetric("kpi", { app, key: params.key });
  const ts = useMetric("kpi_timeseries", {
    app,
    key: params.key,
    range: params.range || "30d",
  });
  const label = useKpiLabel(app, params.key);

  const series =
    ((ts.data as any)?.data as { t: string; value: number }[]) || [];
  const half = Math.floor(series.length / 2);
  const prevAvg = half > 0 ? avg(series.slice(0, half)) : null;
  const currAvg = half > 0 ? avg(series.slice(half)) : null;
  const delta =
    prevAvg !== null && currAvg !== null ? pct(currAvg, prevAvg) : null;
  const err =
    (cur.data as any)?.error ||
    (ts.data as any)?.error ||
    (cur.error as any)?.message ||
    (ts.error as any)?.message;

  const deltaClass =
    delta === null
      ? "kpi-delta"
      : delta > 0
        ? "kpi-delta kpi-delta--up"
        : delta < 0
          ? "kpi-delta kpi-delta--down"
          : "kpi-delta kpi-delta--flat";
  const arrow = delta === null ? "—" : delta > 0 ? "↑" : delta < 0 ? "↓" : "→";

  return (
    <KpiWidgetFrame app={app} label={label} onRemove={onRemove} error={err}>
      <KpiValue
        value={(cur.data as any)?.data}
        loading={cur.isLoading}
        footer={
          <span className={deltaClass}>
            <span aria-hidden>{arrow}</span>
            <span>
              {delta === null
                ? "no prior data"
                : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}% vs prior`}
            </span>
          </span>
        }
      />
    </KpiWidgetFrame>
  );
}

export function KpiTarget({ app, params = {}, onRemove }: WidgetProps) {
  const cur = useMetric("kpi", { app, key: params.key });
  const label = useKpiLabel(app, params.key);
  const value = (cur.data as any)?.data;
  const target = Number(params.target);
  const dir = params.direction === "lower_is_better" ? "low" : "high";

  const numVal =
    typeof value === "number" ? value : Number.isFinite(Number(value)) ? Number(value) : null;

  let state: KpiTone = "default";
  let pctFill: number | null = null;
  if (numVal !== null && Number.isFinite(target) && target !== 0) {
    pctFill = Math.max(0, Math.min(150, (numVal / target) * 100));
    if (dir === "high") {
      state = numVal >= target ? "ok" : numVal >= target * 0.8 ? "warn" : "bad";
    } else {
      state = numVal <= target ? "ok" : numVal <= target * 1.2 ? "warn" : "bad";
    }
  }

  const err = (cur.data as any)?.error || (cur.error as any)?.message;
  const barTone = state === "default" ? "unknown" : state;

  return (
    <KpiWidgetFrame app={app} label={label} onRemove={onRemove} error={err}>
      <KpiValue
        value={value}
        loading={cur.isLoading}
        tone={state}
        footer={
          <>
            <div className="kpi-target__meta">
              <span>
                target {Number.isFinite(target) ? target.toLocaleString() : "—"}
                {dir === "low" ? " · lower is better" : ""}
              </span>
              <span
                className={
                  state === "default" ? "kpi-target__state--unknown" : `kpi-value__hero--${state}`
                }
              >
                {state === "default" ? "—" : state}
              </span>
            </div>
            <div className="kpi-target__bar">
              <div
                className={`kpi-target__bar-fill kpi-target__bar-fill--${barTone}`}
                style={{ width: `${pctFill ?? 0}%` }}
              />
            </div>
          </>
        }
      />
    </KpiWidgetFrame>
  );
}

export function KpiSparkline({ app, params = {}, onRemove }: WidgetProps) {
  const cur = useMetric("kpi", { app, key: params.key });
  const ts = useMetric("kpi_timeseries", {
    app,
    key: params.key,
    range: params.range || "30d",
  });
  const label = useKpiLabel(app, params.key);
  const data = ((ts.data as any)?.data as { t: string; value: number }[]) || [];
  const err =
    (cur.data as any)?.error ||
    (ts.data as any)?.error ||
    (cur.error as any)?.message ||
    (ts.error as any)?.message;

  return (
    <KpiWidgetFrame app={app} label={label} onRemove={onRemove} error={err}>
      <div className="kpi-sparkline">
        <KpiValue value={(cur.data as any)?.data} loading={cur.isLoading} compact />
        <div className="kpi-sparkline__chart">
          {ts.isLoading && data.length === 0 ? (
            <Skeleton variant="chart" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--accent)"
                  strokeWidth={1.75}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </KpiWidgetFrame>
  );
}

function parseKeys(input: unknown): string[] {
  if (Array.isArray(input)) return input.map(String);
  if (typeof input === "string")
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

export function KpiMultiStat({ app, params = {}, onRemove }: WidgetProps) {
  const keys = parseKeys(params.keys);
  const apps = useApps();
  const kpiCatalog =
    apps.data
      ? ((apps.data as any[]).find((a) => a.slug === app)?.kpis as
          | { key: string; label?: string }[]
          | undefined) || []
      : [];

  const results = useQueries({
    queries: keys.map((k) => ({
      queryKey: ["metric", "kpi", `app=${app}&key=${k}`],
      queryFn: () =>
        api.get<{ data?: unknown; error?: string }>(
          `/api/metrics/kpi?app=${encodeURIComponent(app)}&key=${encodeURIComponent(k)}`,
        ),
    })),
  });

  const err = results.find((r) => (r.data as any)?.error)?.data as
    | { error?: string }
    | undefined;

  return (
    <WidgetFrame
      title="Metrics"
      titleVariant="label"
      meta={app}
      onRemove={onRemove}
      error={err?.error}
    >
      <div className="kpi-widget__body">
        {keys.length === 0 ? (
          <div className="widget-empty">
            set params.keys to comma-separated KPI keys
          </div>
        ) : (
          <div
            className="kpi-multistat"
            style={{
              gridTemplateColumns: `repeat(${Math.min(keys.length, 4)}, 1fr)`,
            }}
          >
            {keys.map((k, i) => {
              const r = results[i];
              const cellLabel = kpiCatalog.find((c) => c.key === k)?.label || k;
              return (
                <div key={k} className="kpi-multistat__cell">
                  <span className="kpi-multistat__label" title={k}>
                    {cellLabel}
                  </span>
                  <KpiValue value={(r?.data as any)?.data} loading={r?.isLoading} compact />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WidgetFrame>
  );
}
