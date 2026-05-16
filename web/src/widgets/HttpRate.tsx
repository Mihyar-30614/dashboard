import WidgetFrame from "../grid/WidgetFrame";
import { useMetric } from "../api/hooks";

export default function HttpRate({
  app,

  onRemove,
}: {
  app: string;

  onRemove?: () => void;
}) {
  const q = useMetric("http_rate", { app });
  return (
    <WidgetFrame
      title={`requests · ${app}`}

      onRemove={onRemove}
      meta="last collector tick"
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <div className="metric metric--xl">
        {q.isLoading ? "…" : ((q.data as any)?.data ?? "—")}
      </div>
    </WidgetFrame>
  );
}
