import WidgetFrame from "../grid/WidgetFrame";
import { useApps, useMetric } from "../api/hooks";
import Skeleton from "../grid/Skeleton";

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

export default function KpiDelta({
  app,
  params = {},
  onRemove,
}: {
  app: string;
  params?: any;
  onRemove?: () => void;
}) {
  const cur = useMetric("kpi", { app, key: params.key });
  const ts = useMetric("kpi_timeseries", {
    app,
    key: params.key,
    range: params.range || "30d",
  });
  const apps = useApps();
  const label = apps.data
    ? (apps.data as any[])
        .find((a) => a.slug === app)
        ?.kpis?.find?.((k: any) => k.key === params.key)?.label || params.key
    : params.key;

  const series =
    ((ts.data as any)?.data as { t: string; value: number }[]) || [];
  const half = Math.floor(series.length / 2);
  const prevAvg = half > 0 ? avg(series.slice(0, half)) : null;
  const currAvg = half > 0 ? avg(series.slice(half)) : null;
  const delta =
    prevAvg !== null && currAvg !== null ? pct(currAvg, prevAvg) : null;
  const value = (cur.data as any)?.data;
  const err =
    (cur.data as any)?.error ||
    (ts.data as any)?.error ||
    (cur.error as any)?.message ||
    (ts.error as any)?.message;

  const arrow = delta === null ? "—" : delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const color =
    delta === null
      ? "var(--muted)"
      : delta > 0
      ? "var(--good, #3aa66e)"
      : delta < 0
      ? "var(--bad, #d54a4a)"
      : "var(--muted)";

  return (
    <WidgetFrame
      title={`kpi · ${app}`}
      onRemove={onRemove}
      meta={label}
      error={err}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          height: "100%",
          justifyContent: "center",
        }}
      >
        <div className="metric metric--lg">
          {cur.isLoading ? (
            <Skeleton variant="block" width={96} height={28} />
          ) : (
            (value ?? "—")
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color,
          }}
        >
          <span>{arrow}</span>
          <span>
            {delta === null
              ? "no prior data"
              : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}% vs prior`}
          </span>
        </div>
      </div>
    </WidgetFrame>
  );
}
