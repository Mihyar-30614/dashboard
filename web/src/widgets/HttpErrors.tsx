import WidgetFrame from "../grid/WidgetFrame";
import { useMetric } from "../api/hooks";

export default function HttpErrors({
  app,

  onRemove,
}: {
  app: string;

  onRemove?: () => void;
}) {
  const q = useMetric("http_errors", { app });
  const v = (q.data as any)?.data;
  const bad = typeof v === "number" && v > 0;
  return (
    <WidgetFrame
      title={`errors · ${app}`}

      onRemove={onRemove}
      meta="last collector tick"
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <div
        className="metric metric--xl"
        style={{ color: bad ? "var(--bad)" : "var(--text)" }}
      >
        {q.isLoading ? "…" : (v ?? "—")}
      </div>
    </WidgetFrame>
  );
}
