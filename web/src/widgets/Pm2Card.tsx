import WidgetFrame from "../grid/WidgetFrame";
import { useMetric } from "../api/hooks";

export default function Pm2Card({
  app,

  onRemove,
}: {
  app: string;

  onRemove?: () => void;
}) {
  const q = useMetric("pm2", { app });
  const d = (q.data as any)?.data || {};
  const status = d.status || "—";
  const ledKind =
    status === "online" ? "led--ok" : status === "stopped" ? "led--bad" : "";

  return (
    <WidgetFrame
      title={`pm2 · ${app}`}

      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className={`led ${ledKind}`} style={{ width: 10, height: 10 }} />
        <span
          className="metric"
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: status === "online" ? "var(--ok)" : "var(--text)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {status}
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid var(--rule)",
        }}
      >
        {[
          { label: "cpu", val: d.cpu != null ? `${d.cpu}%` : "—" },
          {
            label: "mem",
            val:
              d.mem_bytes != null
                ? `${Math.round(d.mem_bytes / 1e6)}MB`
                : "—",
          },
          { label: "restart", val: d.restarts ?? "—" },
        ].map((s) => (
          <div key={s.label}>
            <div
              className="eyebrow"
              style={{ fontSize: 9, marginBottom: 2 }}
            >
              {s.label}
            </div>
            <div className="metric" style={{ fontSize: 14 }}>
              {s.val}
            </div>
          </div>
        ))}
      </div>
    </WidgetFrame>
  );
}
