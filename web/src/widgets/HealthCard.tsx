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
  const state = ok === undefined ? "—" : ok ? "UP" : "DOWN";
  const led = ok === undefined ? "" : ok ? "led--ok" : "led--bad";

  return (
    <WidgetFrame
      title={`health · ${app}`}
      editing={editing}
      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 8,
        }}
      >
        <span className={`led ${led}`} style={{ width: 12, height: 12 }} />
        <span
          className="metric metric--lg"
          style={{
            color:
              ok === undefined
                ? "var(--muted)"
                : ok
                  ? "var(--ok)"
                  : "var(--bad)",
          }}
        >
          {state}
        </span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--muted)",
          letterSpacing: "0.04em",
        }}
      >
        {data
          ? `${data.latency_ms}ms · http ${data.status ?? data.error ?? "—"}`
          : "probing…"}
      </div>
    </WidgetFrame>
  );
}
