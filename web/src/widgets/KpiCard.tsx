import WidgetFrame from "../grid/WidgetFrame";
import { useMetric, useApps } from "../api/hooks";

export default function KpiCard({
  app,
  params = {},
  editing,
  onRemove,
}: {
  app: string;
  params?: any;
  editing: boolean;
  onRemove?: () => void;
}) {
  const q = useMetric("kpi", { app, key: params.key });
  const apps = useApps();
  const label = apps.data
    ? (apps.data as any[])
        .find((a) => a.slug === app)
        ?.kpis?.find?.((k: any) => k.key === params.key)?.label || params.key
    : params.key;
  return (
    <WidgetFrame
      title={label || "KPI"}
      editing={editing}
      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <div style={{ fontSize: 28, fontWeight: 600 }}>
        {q.isLoading ? "…" : ((q.data as any)?.data ?? "—")}
      </div>
    </WidgetFrame>
  );
}
