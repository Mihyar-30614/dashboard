import { Line, LineChart, ResponsiveContainer } from "recharts";
import WidgetFrame from "../grid/WidgetFrame";
import { useApps, useMetric } from "../api/hooks";
import Skeleton from "../grid/Skeleton";

export default function KpiSparkline({
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
  const data = ((ts.data as any)?.data as { t: string; value: number }[]) || [];
  const value = (cur.data as any)?.data;
  const err =
    (cur.data as any)?.error ||
    (ts.data as any)?.error ||
    (cur.error as any)?.message ||
    (ts.error as any)?.message;
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
          height: "100%",
          gap: 6,
        }}
      >
        <div className="metric metric--lg">
          {cur.isLoading ? (
            <Skeleton variant="block" width={96} height={28} />
          ) : (
            (value ?? "—")
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {ts.isLoading && data.length === 0 ? (
            <Skeleton variant="chart" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--chart-5)"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </WidgetFrame>
  );
}
