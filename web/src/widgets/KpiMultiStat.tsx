import { useQueries } from "@tanstack/react-query";
import WidgetFrame from "../grid/WidgetFrame";
import { useApps } from "../api/hooks";
import { api } from "../api/client";
import Skeleton from "../grid/Skeleton";

function parseKeys(input: unknown): string[] {
  if (Array.isArray(input)) return input.map(String);
  if (typeof input === "string")
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

export default function KpiMultiStat({
  app,
  params = {},
  onRemove,
}: {
  app: string;
  params?: any;
  onRemove?: () => void;
}) {
  const keys = parseKeys(params.keys);
  const apps = useApps();
  const kpiCatalog =
    apps.data
      ? ((apps.data as any[]).find((a) => a.slug === app)?.kpis as
          | { key: string; label?: string }[]
          | undefined) || []
      : [];

  const results = useQueries({
    queries: keys.map((k) => ({
      queryKey: ["metric", "kpi", `app=${app}&key=${k}`],
      queryFn: () =>
        api.get<{ data?: unknown; error?: string }>(
          `/api/metrics/kpi?app=${encodeURIComponent(app)}&key=${encodeURIComponent(k)}`,
        ),
    })),
  });

  const err = results.find((r) => (r.data as any)?.error)?.data as
    | { error?: string }
    | undefined;

  return (
    <WidgetFrame
      title={`stats · ${app}`}
      onRemove={onRemove}
      error={err?.error}
    >
      {keys.length === 0 ? (
        <div
          style={{
            color: "var(--muted)",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            padding: 8,
          }}
        >
          set params.keys to comma-separated KPI keys
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(keys.length, 4)}, 1fr)`,
            gap: 14,
            height: "100%",
            alignItems: "center",
          }}
        >
          {keys.map((k, i) => {
            const r = results[i];
            const label =
              kpiCatalog.find((c) => c.key === k)?.label ||
              k;
            const v = (r?.data as any)?.data;
            return (
              <div
                key={k}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  paddingRight: i < keys.length - 1 ? 14 : 0,
                  borderRight:
                    i < keys.length - 1 ? "1px solid var(--rule)" : "none",
                }}
              >
                <span
                  className="eyebrow"
                  style={{ fontSize: 9 }}
                  title={k}
                >
                  {label}
                </span>
                <span className="metric metric--lg">
                  {r?.isLoading ? (
                    <Skeleton variant="block" width={72} height={28} />
                  ) : (
                    (v ?? "—")
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </WidgetFrame>
  );
}
