import WidgetFrame from "../grid/WidgetFrame";
import { useMetric } from "../api/hooks";

export default function UsersTotal({
  app,
  editing,
  onRemove,
}: {
  app: string;
  editing: boolean;
  onRemove?: () => void;
}) {
  const q = useMetric("users_total", { app });
  return (
    <WidgetFrame
      title={`users · ${app}`}
      editing={editing}
      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <div className="metric metric--xl">
        {q.isLoading ? "…" : ((q.data as any)?.data ?? "—")}
      </div>
      <div
        className="eyebrow"
        style={{ marginTop: 10, fontSize: 9 }}
      >
        total registered
      </div>
    </WidgetFrame>
  );
}
