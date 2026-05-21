import WidgetFrame from "../grid/WidgetFrame";
import { useMetric } from "../api/hooks";
import Skeleton from "../grid/Skeleton";

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
        {q.isLoading ? (
          <Skeleton variant="block" width={120} height={40} />
        ) : (
          (v ?? "—")
        )}
      </div>
    </WidgetFrame>
  );
}
