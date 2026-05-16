import WidgetFrame from "../grid/WidgetFrame";
import { useMetric } from "../api/hooks";

export default function HttpLatency({
  app,

  onRemove,
}: {
  app: string;

  onRemove?: () => void;
}) {
  const q = useMetric("http_latency", { app });
  const v = (q.data as any)?.data;
  return (
    <WidgetFrame
      title={`p95 latency · ${app}`}

      onRemove={onRemove}
      meta="ms · last tick"
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <div className="metric metric--xl">
        {q.isLoading ? "…" : (v ?? "—")}
        <span
          style={{
            fontSize: 16,
            color: "var(--muted)",
            marginLeft: 6,
            fontWeight: 400,
          }}
        >
          ms
        </span>
      </div>
    </WidgetFrame>
  );
}
