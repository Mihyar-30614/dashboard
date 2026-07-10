import WidgetFrame from "../grid/WidgetFrame";
import Skeleton from "../grid/Skeleton";
import { useMetric } from "../api/hooks";

type WidgetProps = {
  app: string;
  params?: any;
  onRemove?: () => void;
};

function ScalarMetric({
  loading,
  value,
  caption,
}: {
  loading: boolean;
  value: unknown;
  caption?: string;
}) {
  return (
    <div className="metric-widget">
      <div className="metric metric--xl">
        {loading ? (
          <Skeleton variant="block" width={120} height={40} />
        ) : (
          String(value ?? "—")
        )}
      </div>
      {caption && <div className="eyebrow metric-widget__caption">{caption}</div>}
    </div>
  );
}

export function UsersTotal({ app, onRemove }: WidgetProps) {
  const q = useMetric("users_total", { app });
  return (
    <WidgetFrame
      title={`users · ${app}`}
      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <ScalarMetric
        loading={q.isLoading}
        value={(q.data as any)?.data}
        caption="total registered"
      />
    </WidgetFrame>
  );
}

export function DauCard({ app, onRemove }: WidgetProps) {
  const q = useMetric("dau", { app });
  return (
    <WidgetFrame
      title={`dau · ${app}`}
      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <ScalarMetric
        loading={q.isLoading}
        value={(q.data as any)?.data}
        caption="active · last 24h"
      />
    </WidgetFrame>
  );
}

export function HealthCard({ app, onRemove }: WidgetProps) {
  const q = useMetric("health", { app });
  const data = (q.data as any)?.data;
  const ok = data?.ok;
  const state = ok === undefined ? "—" : ok ? "UP" : "DOWN";
  const led = ok === undefined ? "" : ok ? "led--ok" : "led--bad";
  const stateTone =
    ok === undefined ? "metric-widget__state--muted" : ok ? "metric-widget__state--ok" : "metric-widget__state--bad";

  return (
    <WidgetFrame
      title={`health · ${app}`}
      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <div className="metric-widget">
        <div className="metric-widget__status-row">
          <span className={`led led--lg ${led}`} />
          <span className={`metric metric--lg ${stateTone}`}>{state}</span>
        </div>
        <div className="metric-widget__detail">
          {data
            ? `${data.latency_ms}ms · http ${data.status ?? data.error ?? "—"}`
            : "probing…"}
        </div>
      </div>
    </WidgetFrame>
  );
}

export function Pm2Card({ app, onRemove }: WidgetProps) {
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
      <div className="metric-widget">
        <div className="metric-widget__status-row metric-widget__status-row--compact">
          <span className={`led led--sm ${ledKind}`} />
          <span className={`metric pm2-status${status === "online" ? " pm2-status--online" : ""}`}>
            {status}
          </span>
        </div>
        <div className="pm2-stats">
          {[
            { label: "cpu", val: d.cpu != null ? `${d.cpu}%` : "—" },
            {
              label: "mem",
              val: d.mem_bytes != null ? `${Math.round(d.mem_bytes / 1e6)}MB` : "—",
            },
            { label: "restart", val: d.restarts ?? "—" },
          ].map((s) => (
            <div key={s.label}>
              <div className="eyebrow pm2-stat__label">{s.label}</div>
              <div className="metric pm2-stat__value">{s.val}</div>
            </div>
          ))}
        </div>
      </div>
    </WidgetFrame>
  );
}

export function HttpRate({ app, onRemove }: WidgetProps) {
  const q = useMetric("http_rate", { app });
  return (
    <WidgetFrame
      title={`requests · ${app}`}
      onRemove={onRemove}
      meta="last collector tick"
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <div className="metric-widget">
        <div className="metric metric--xl">
          {q.isLoading ? (
            <Skeleton variant="block" width={120} height={40} />
          ) : (
            ((q.data as any)?.data ?? "—")
          )}
        </div>
      </div>
    </WidgetFrame>
  );
}

export function HttpErrors({ app, onRemove }: WidgetProps) {
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
      <div className="metric-widget">
        <div className={`metric metric--xl${bad ? " metric-widget__value--bad" : ""}`}>
          {q.isLoading ? (
            <Skeleton variant="block" width={120} height={40} />
          ) : (
            (v ?? "—")
          )}
        </div>
      </div>
    </WidgetFrame>
  );
}

export function HttpLatency({ app, onRemove }: WidgetProps) {
  const q = useMetric("http_latency", { app });
  const v = (q.data as any)?.data;
  return (
    <WidgetFrame
      title={`p95 latency · ${app}`}
      onRemove={onRemove}
      meta="ms · last tick"
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <div className="metric-widget">
        <div className="metric metric--xl">
          {q.isLoading ? (
            <Skeleton variant="block" width={100} height={40} />
          ) : (
            (v ?? "—")
          )}
          <span className="metric-widget__unit">ms</span>
        </div>
      </div>
    </WidgetFrame>
  );
}

export type UptimeBucket = { bucket: number; ratio: number | null; samples: number };

export function bucketColor(ratio: number | null, samples: number): string {
  if (samples === 0 || ratio == null) return "var(--border)";
  if (ratio >= 0.995) return "var(--ok)";
  if (ratio > 0.5) return "var(--warn)";
  return "var(--bad)";
}

export function overallUptime(buckets: UptimeBucket[]): number | null {
  let up = 0;
  let total = 0;
  for (const b of buckets) {
    if (b.samples > 0 && b.ratio != null) {
      up += b.ratio * b.samples;
      total += b.samples;
    }
  }
  return total === 0 ? null : up / total;
}

export function UptimeStrip({ app, params = {}, onRemove }: WidgetProps) {
  const range = params.range || "7d";
  const q = useMetric("uptime", { app, range });
  const payload = (q.data as { data?: { buckets: UptimeBucket[] }; error?: string }) ?? {};
  const buckets = payload.data?.buckets ?? [];
  const uptime = overallUptime(buckets);
  const meta =
    uptime == null ? `${range} · no data` : `${range} · ${(uptime * 100).toFixed(2)}% up`;

  return (
    <WidgetFrame
      title={`uptime · ${app}`}
      onRemove={onRemove}
      meta={meta}
      error={payload.error ?? (q.error as Error | null)?.message ?? null}
    >
      {q.isLoading && buckets.length === 0 ? (
        <Skeleton variant="block" height={24} />
      ) : (
        <div className="uptime-strip">
          {buckets.map((b) => (
            <span
              key={b.bucket}
              className="uptime-strip__bucket"
              title={
                b.samples === 0
                  ? "no data"
                  : `${((b.ratio ?? 0) * 100).toFixed(1)}% up`
              }
              style={{ background: bucketColor(b.ratio, b.samples) }}
            />
          ))}
        </div>
      )}
    </WidgetFrame>
  );
}
