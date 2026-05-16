import WidgetFrame from "../grid/WidgetFrame";
import { useMetric } from "../api/hooks";

export default function HealthCard({
  app,
  editing,
  onRemove,
}: {
  app: string;
  editing: boolean;
  onRemove?: () => void;
}) {
  const q = useMetric("health", { app });
  const data = (q.data as any)?.data;
  const ok = data?.ok;
  return (
    <WidgetFrame
      title="Health"
      editing={editing}
      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <div
        style={{
          fontSize: 18,
          color: ok ? "var(--chart-2)" : "var(--chart-4)",
        }}
      >
        {ok === undefined ? "…" : ok ? "UP" : "DOWN"}
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12 }}>
        {data ? `${data.latency_ms}ms · ${data.status ?? data.error ?? ""}` : ""}
      </div>
    </WidgetFrame>
  );
}
