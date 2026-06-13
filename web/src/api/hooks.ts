import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

const METRIC_STALE_MS = 25_000;
const METRIC_REFETCH_MS = 30_000;

type AppInfo = {
  slug: string;
  label: string;
  pm2_name: string;
  pm2_status: string;
  pm2_cpu?: number;
  pm2_mem_bytes?: number;
  health: { ok: boolean; status?: number; latency_ms: number; error?: string };
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () =>
      api.get<{ id: number; email: string; is_admin: boolean }>("/api/auth/me"),
    retry: false,
    staleTime: Infinity,
  });
}

export function useApps() {
  return useQuery({
    queryKey: ["apps"],
    queryFn: () => api.get<AppInfo[]>("/api/apps"),
    staleTime: METRIC_STALE_MS,
    refetchInterval: METRIC_REFETCH_MS,
  });
}

export function useMetric(kind: string, params: Record<string, unknown> = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return useQuery({
    queryKey: ["metric", kind, qs],
    queryFn: () =>
      api.get<{ data?: unknown; error?: string; stale?: boolean }>(
        `/api/metrics/${kind}?${qs}`,
      ),
    staleTime: METRIC_STALE_MS,
    refetchInterval: METRIC_REFETCH_MS,
  });
}

export function useLayout(screen: string) {
  return useQuery({
    queryKey: ["layout", screen],
    queryFn: () =>
      api.get<{ layout: any[]; default?: boolean; updated_at?: string }>(
        `/api/layouts/${screen}`,
      ),
    staleTime: Infinity,
  });
}

export function useSaveLayout(screen: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (layout: any[]) =>
      api.put<{ ok: boolean; updated_at: string }>(`/api/layouts/${screen}`, {
        layout,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["layout", screen] }),
  });
}

export type { AppInfo };
