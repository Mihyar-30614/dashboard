import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export type SqlVizKind = "number" | "line" | "bar" | "table";

export type SqlWidget = {
  id: number;
  name: string;
  description: string | null;
  data_source: string;
  sql: string;
  viz: SqlVizKind;
  options: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type DataSource = {
  name: string;
  kind: string;
  scope: "overview" | "app";
  app_slug?: string;
};

export type SqlRunResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  durationMs: number;
};

export type PreviewResult = SqlRunResult & { inferred_viz: SqlVizKind };

export function useSqlWidgets() {
  return useQuery({
    queryKey: ["sql-widgets"],
    queryFn: () => api.get<SqlWidget[]>("/api/sql-widgets"),
    staleTime: Infinity,
  });
}

export function useSqlWidget(id: number) {
  return useQuery({
    queryKey: ["sql-widget", id],
    queryFn: () => api.get<SqlWidget>(`/api/sql-widgets/${id}`),
    enabled: Number.isFinite(id),
    staleTime: Infinity,
  });
}

export function useSqlDataSources() {
  return useQuery({
    queryKey: ["sql-data-sources"],
    queryFn: () => api.get<DataSource[]>("/api/sql-widgets/sources"),
    staleTime: Infinity,
  });
}

export function useSqlRun(id: number, range: string) {
  return useQuery({
    queryKey: ["sql-run", id, range],
    queryFn: () =>
      api.get<{ data?: SqlRunResult; error?: string }>(
        `/api/sql-widgets/${id}/run?range=${encodeURIComponent(range)}`
      ),
    enabled: Number.isFinite(id),
    staleTime: 25_000,
    refetchInterval: 30_000,
  });
}

export function useSqlPreview() {
  return useMutation({
    mutationFn: (body: { data_source: string; sql: string; range: string }) =>
      api.post<PreviewResult & { error?: string }>("/api/sql-widgets/preview", body),
  });
}

export function useCreateSqlWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<SqlWidget>) =>
      api.post<SqlWidget>("/api/sql-widgets", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sql-widgets"] }),
  });
}

export function useUpdateSqlWidget(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<SqlWidget>) =>
      api.patch<SqlWidget>(`/api/sql-widgets/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sql-widgets"] });
      qc.invalidateQueries({ queryKey: ["sql-widget", id] });
    },
  });
}

export function useDeleteSqlWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<{ ok: boolean }>(`/api/sql-widgets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sql-widgets"] }),
  });
}
