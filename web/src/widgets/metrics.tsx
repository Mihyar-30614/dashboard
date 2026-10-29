import WidgetFrame from "../grid/WidgetFrame";
import Skeleton from "../grid/Skeleton";
import { useMetric } from "../api/hooks";
import { Hero, InsightFrame, Note, Stats, ago, useInsight } from "./parts";

type WidgetProps = {
  app: string;
  params?: any;
  onRemove?: () => void;
};

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

type Traffic = {
  per_min: number;
  last_5m: { count: number };
  last_hour: { count: number; errors_4xx: number; errors_5xx: number };
  p95_ms_15m: number;
};

const LOG_HINT: Record<string, string> = {
  log_unreadable: "No access log for this app yet. Apply config/nginx/observatory-log.conf.",
  log_format_unrecognized: "The access log has no $request_time. Use the observatory log format.",
};

export function TrafficCard({ app, onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Traffic>("traffic", { app });
  return (
    <InsightFrame title="Traffic" meta={app} loading={loading} error={error} onRemove={onRemove}>
      {d ? (
        <div className="ins-stack">
          <Hero value={d.per_min} label="requests / min · last 5 min" />
          <Stats
            items={[
              { label: "requests 1h", value: d.last_hour.count },
              { label: "4xx 1h", value: d.last_hour.errors_4xx, tone: d.last_hour.errors_4xx ? "warn" : undefined },
              { label: "5xx 1h", value: d.last_hour.errors_5xx, tone: d.last_hour.errors_5xx ? "bad" : "ok" },
              { label: "p95 15m", value: `${d.p95_ms_15m}ms` },
            ]}
          />
        </div>
      ) : (
        error && LOG_HINT[error] && <Note tone="warn">{LOG_HINT[error]}</Note>
      )}
    </InsightFrame>
  );
}

type AppStatusData = {
  health: { ok: boolean; status?: number; latency_ms?: number; error?: string };
  pm2: { status: string; cpu?: number; mem_bytes?: number; restarts?: number };
  http: { errors_5xx?: number; count?: number; error?: string };
  job: { label: string; value?: number; last_at?: string | null; attention: number; error?: string } | null;
};

export function AppStatus({ app, onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<AppStatusData>("app_status", { app });
  return (
    <InsightFrame title={app} meta="status" loading={loading} error={error} onRemove={onRemove}>
      {d && (
        <div className="ins-status">
          <div className="ins-status__cell">
            <span className={`led led--lg ${d.health.ok ? "led--ok" : "led--bad"}`} />
            <div>
              <div className={`metric ins-tone--${d.health.ok ? "ok" : "bad"}`}>{d.health.ok ? "UP" : "DOWN"}</div>
              <div className="ins-status__sub">
                {d.health.latency_ms != null ? `${d.health.latency_ms}ms` : d.health.error ?? "—"}
              </div>
            </div>
          </div>
          <div className="ins-status__cell">
            <div>
              <div className={`metric ins-tone--${d.pm2.status === "online" ? "ok" : "bad"}`}>{d.pm2.status}</div>
              <div className="ins-status__sub">
                {/* pm2 reports 0/0 when it can't sample the process; that isn't a reading. */}
                {d.pm2.cpu || d.pm2.mem_bytes
                  ? `${d.pm2.cpu}% cpu · ${Math.round((d.pm2.mem_bytes ?? 0) / 1e6)}MB`
                  : "pm2"}
                {d.pm2.restarts ? ` · ${d.pm2.restarts} restarts` : ""}
              </div>
            </div>
          </div>
          <div className="ins-status__cell" title={d.http.error}>
            <div>
              <div className={`metric ${d.http.error ? "" : d.http.errors_5xx ? "ins-tone--bad" : "ins-tone--ok"}`}>
                {d.http.error ? "—" : d.http.errors_5xx}
              </div>
              <div className="ins-status__sub">{d.http.error ? "no access log" : `5xx of ${d.http.count} req · 1h`}</div>
            </div>
          </div>
          {d.job && (
            <div className="ins-status__cell" title={d.job.error}>
              <div>
                <div className={`metric ${d.job.attention ? "ins-tone--warn" : ""}`}>
                  {d.job.error ? "—" : d.job.value ?? ago(d.job.last_at)}
                </div>
                <div className="ins-status__sub">{d.job.label}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </InsightFrame>
  );
}
