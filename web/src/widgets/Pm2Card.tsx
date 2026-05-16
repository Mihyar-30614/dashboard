import WidgetFrame from "../grid/WidgetFrame";
import { useMetric } from "../api/hooks";

export default function Pm2Card({
  app,
  editing,
  onRemove,
}: {
  app: string;
  editing: boolean;
  onRemove?: () => void;
}) {
  const q = useMetric("pm2", { app });
  const d = (q.data as any)?.data || {};
  return (
    <WidgetFrame
      title="PM2"
      editing={editing}
      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <div>
        <strong>{d.status || "…"}</strong>
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12 }}>
        cpu {d.cpu ?? "—"}% · mem{" "}
        {d.mem_bytes ? Math.round(d.mem_bytes / 1e6) + "MB" : "—"} · restarts{" "}
        {d.restarts ?? "—"}
      </div>
    </WidgetFrame>
  );
}
