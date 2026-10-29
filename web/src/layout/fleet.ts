import { useApps } from "../api/hooks";

export type FleetState = "ok" | "warn" | "bad" | "unknown";

export type FleetApp = {
  slug: string;
  label: string;
  state: FleetState;
  /** Health check round trip; null when the check never answered. */
  latencyMs: number | null;
  /** Plain-language reason for the state, for titles and screen readers. */
  detail: string;
};

/** Down when the health check fails; degraded when it answers but PM2
 * does not report the process online. */
function stateOf(a: {
  pm2_status: string;
  health: { ok: boolean; status?: number; error?: string };
}): { state: FleetState; detail: string } {
  if (!a.health.ok) {
    const why = a.health.error || (a.health.status ? `HTTP ${a.health.status}` : "no answer");
    return { state: "bad", detail: `Health check failing (${why})` };
  }
  if (a.pm2_status !== "online") {
    return { state: "warn", detail: `Healthy, but PM2 reports ${a.pm2_status}` };
  }
  return { state: "ok", detail: "Healthy · PM2 online" };
}

const RANK: Record<FleetState, number> = { unknown: 0, ok: 1, warn: 2, bad: 3 };

export function useFleet() {
  const q = useApps();
  const apps: FleetApp[] = (q.data ?? []).map((a) => ({
    slug: a.slug,
    label: a.label,
    latencyMs: a.health?.ok ? a.health.latency_ms : null,
    ...stateOf(a),
  }));
  const up = apps.filter((a) => a.state === "ok").length;
  const worst = apps.reduce<FleetState>(
    (w, a) => (RANK[a.state] > RANK[w] ? a.state : w),
    q.data ? "ok" : "unknown",
  );
  return {
    apps,
    up,
    total: apps.length,
    worst: q.isError ? ("bad" as const) : worst,
    error: q.isError,
    updatedAt: q.dataUpdatedAt || null,
  };
}

/** Summary sentence for the whole fleet. */
export function fleetSummary(f: ReturnType<typeof useFleet>): string {
  if (f.error) return "Fleet status unavailable";
  if (f.total === 0) return "Checking fleet…";
  const down = f.apps.filter((a) => a.state === "bad").length;
  const degraded = f.apps.filter((a) => a.state === "warn").length;
  if (down) return `${down} of ${f.total} down`;
  if (degraded) return `${degraded} of ${f.total} degraded`;
  return `All ${f.total} up`;
}
