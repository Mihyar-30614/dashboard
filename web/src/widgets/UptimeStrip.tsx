import WidgetFrame from "../grid/WidgetFrame";
import { useMetric } from "../api/hooks";
import Skeleton from "../grid/Skeleton";

export type UptimeBucket = { bucket: number; ratio: number | null; samples: number };

export function bucketColor(ratio: number | null, samples: number): string {
  if (samples === 0 || ratio == null) return "var(--rule)";
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

export default function UptimeStrip({
  app,
  params = {},
  onRemove,
}: {
  app: string;
  params?: { range?: string };
  onRemove?: () => void;
}) {
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
        <div
          style={{
            display: "flex",
            gap: 2,
            alignItems: "stretch",
            height: "100%",
            minHeight: 18,
            maxHeight: 36,
          }}
        >
          {buckets.map((b) => (
            <span
              key={b.bucket}
              title={
                b.samples === 0
                  ? "no data"
                  : `${((b.ratio ?? 0) * 100).toFixed(1)}% up`
              }
              style={{
                flex: 1,
                borderRadius: 2,
                background: bucketColor(b.ratio, b.samples),
              }}
            />
          ))}
        </div>
      )}
    </WidgetFrame>
  );
}
