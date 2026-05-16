import WidgetFrame from "../grid/WidgetFrame";
import { useMetric, useApps } from "../api/hooks";

export default function KpiCard({
  app,
  params = {},

  onRemove,
}: {
  app: string;
  params?: any;

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
      title={`kpi · ${app}`}

      onRemove={onRemove}
      meta={label}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <div className="metric metric--lg">
        {q.isLoading ? "…" : ((q.data as any)?.data ?? "—")}
      </div>
    </WidgetFrame>
  );
}
