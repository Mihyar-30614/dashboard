import WidgetFrame from "../grid/WidgetFrame";
import { useApps, useMetric } from "../api/hooks";
import Skeleton from "../grid/Skeleton";

export default function KpiTarget({
  app,
  params = {},
  onRemove,
}: {
  app: string;
  params?: any;
  onRemove?: () => void;
}) {
  const cur = useMetric("kpi", { app, key: params.key });
  const apps = useApps();
  const label = apps.data
    ? (apps.data as any[])
        .find((a) => a.slug === app)
        ?.kpis?.find?.((k: any) => k.key === params.key)?.label || params.key
    : params.key;
  const value = (cur.data as any)?.data;
  const target = Number(params.target);
  const dir = params.direction === "lower_is_better" ? "low" : "high";

  const numVal =
    typeof value === "number" ? value : Number.isFinite(Number(value)) ? Number(value) : null;

  let state: "good" | "warn" | "bad" | "unknown" = "unknown";
  let pct: number | null = null;
  if (numVal !== null && Number.isFinite(target) && target !== 0) {
    pct = Math.max(0, Math.min(150, (numVal / target) * 100));
    if (dir === "high") {
      state = numVal >= target ? "good" : numVal >= target * 0.8 ? "warn" : "bad";
    } else {
      state = numVal <= target ? "good" : numVal <= target * 1.2 ? "warn" : "bad";
    }
  }

  const barColor =
    state === "good"
      ? "var(--good, #3aa66e)"
      : state === "warn"
      ? "var(--warn, #d6a23a)"
      : state === "bad"
      ? "var(--bad, #d54a4a)"
      : "var(--muted)";

  const err = (cur.data as any)?.error || (cur.error as any)?.message;
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
          gap: 8,
          height: "100%",
          justifyContent: "center",
        }}
      >
        <div className="metric metric--lg" style={{ color: barColor }}>
          {cur.isLoading ? (
            <Skeleton variant="block" width={96} height={28} />
          ) : (
            (value ?? "—")
          )}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--muted)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>
            target: {Number.isFinite(target) ? target : "—"}
            {dir === "low" ? " (lower)" : ""}
          </span>
          <span style={{ color: barColor }}>{state.toUpperCase()}</span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: "var(--rule)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct ?? 0}%`,
              height: "100%",
              background: barColor,
              transition: "width 200ms",
            }}
          />
        </div>
      </div>
    </WidgetFrame>
  );
}
