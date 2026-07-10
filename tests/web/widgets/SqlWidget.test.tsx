import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SqlWidget from "@/widgets/sql";
import * as hooks from "@/api/sqlWidgets";

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("SqlWidget", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows skeleton while loading", () => {
    vi.spyOn(hooks, "useSqlWidget").mockReturnValue({ isLoading: true } as any);
    vi.spyOn(hooks, "useSqlRun").mockReturnValue({ isLoading: true } as any);
    wrap(<SqlWidget widgetId={1} params={{ range: "7d" }} />);
    expect(screen.getByTestId("widget-skeleton")).toBeInTheDocument();
  });

  it("renders SqlNumber for viz=number", async () => {
    vi.spyOn(hooks, "useSqlWidget").mockReturnValue({
      data: { id: 1, name: "X", description: null, data_source: "sportly",
              sql: "SELECT 1", viz: "number", options: {},
              created_at: "", updated_at: "" },
      isLoading: false,
    } as any);
    vi.spyOn(hooks, "useSqlRun").mockReturnValue({
      data: { data: { columns: ["v"], rows: [{ v: 7 }], truncated: false, durationMs: 1 } },
      isLoading: false,
    } as any);
    wrap(<SqlWidget widgetId={1} params={{ range: "7d" }} />);
    await waitFor(() => expect(screen.getByText("7")).toBeInTheDocument());
  });

  it("shows error from envelope", () => {
    vi.spyOn(hooks, "useSqlWidget").mockReturnValue({
      data: { id: 1, name: "X", description: null, data_source: "sportly",
              sql: "X", viz: "number", options: {}, created_at: "", updated_at: "" },
      isLoading: false,
    } as any);
    vi.spyOn(hooks, "useSqlRun").mockReturnValue({
      data: { error: "timeout" }, isLoading: false,
    } as any);
    wrap(<SqlWidget widgetId={1} params={{ range: "7d" }} />);
    expect(screen.getByTitle("timeout")).toBeInTheDocument();
  });

  it("shows deleted-widget tile when metadata 404s", () => {
    vi.spyOn(hooks, "useSqlWidget").mockReturnValue({
      isLoading: false, error: { status: 404 },
    } as any);
    vi.spyOn(hooks, "useSqlRun").mockReturnValue({ isLoading: false } as any);
    wrap(<SqlWidget widgetId={1} params={{ range: "7d" }} />);
    expect(screen.getByText(/widget deleted/i)).toBeInTheDocument();
  });
});
