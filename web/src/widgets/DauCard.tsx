import WidgetFrame from "../grid/WidgetFrame";
import { useMetric } from "../api/hooks";

export default function DauCard({
  app,
  editing,
  onRemove,
}: {
  app: string;
  editing: boolean;
  onRemove?: () => void;
}) {
  const q = useMetric("dau", { app });
  return (
    <WidgetFrame
      title="DAU"
      editing={editing}
      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <div style={{ fontSize: 32, fontWeight: 600 }}>
        {q.isLoading ? "…" : ((q.data as any)?.data ?? "—")}
      </div>
    </WidgetFrame>
  );
}
