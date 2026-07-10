import { describe, it, expect, vi } from "vitest";
import { forwardRef } from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import SqlWidgets from "@/pages/SqlWidgets";
import * as hooks from "@/api/sqlWidgets";

// CodeMirror is not a form control; shim it as a textarea for these tests.
vi.mock("@uiw/react-codemirror", () => ({
  __esModule: true,
  default: forwardRef(function CodeMirrorShim(
    { value, onChange, "aria-label": ariaLabel }: any,
    _ref: any,
  ) {
    return (
      <textarea
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }),
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("SqlWidgets page", () => {
  it("lists existing widgets", () => {
    vi.spyOn(hooks, "useSqlWidgets").mockReturnValue({
      data: [{ id: 1, name: "Top users", description: null, data_source: "sportly",
                sql: "SELECT 1", viz: "table", options: {}, created_at: "", updated_at: "" }],
      isLoading: false,
    } as any);
    vi.spyOn(hooks, "useSqlDataSources").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(hooks, "useDeleteSqlWidget").mockReturnValue({ mutateAsync: vi.fn() } as any);
    wrap(<SqlWidgets />);
    expect(screen.getByText("Top users")).toBeInTheDocument();
    expect(screen.getByText("sportly")).toBeInTheDocument();
  });
  it("renders widgets as row-list items, not a <table>", () => {
    vi.spyOn(hooks, "useSqlWidgets").mockReturnValue({
      data: [{ id: 1, name: "Top users", description: "desc", data_source: "sportly",
                sql: "SELECT 1", viz: "table", options: {}, created_at: "", updated_at: "" }],
      isLoading: false,
    } as any);
    vi.spyOn(hooks, "useSqlDataSources").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(hooks, "useDeleteSqlWidget").mockReturnValue({ mutateAsync: vi.fn() } as any);
    wrap(<SqlWidgets />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Top users")).toBeInTheDocument();
  });
  it("shows empty state when no widgets", () => {
    vi.spyOn(hooks, "useSqlWidgets").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(hooks, "useSqlDataSources").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(hooks, "useDeleteSqlWidget").mockReturnValue({ mutateAsync: vi.fn() } as any);
    wrap(<SqlWidgets />);
    expect(screen.getByText(/no sql widgets yet/i)).toBeInTheDocument();
  });
});

describe("SqlWidgets editor", () => {
  it("closes on backdrop click", () => {
    vi.spyOn(hooks, "useSqlWidgets").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(hooks, "useSqlDataSources").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(hooks, "useSqlPreview").mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.spyOn(hooks, "useCreateSqlWidget").mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(hooks, "useUpdateSqlWidget").mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(hooks, "useDeleteSqlWidget").mockReturnValue({ mutateAsync: vi.fn() } as any);

    wrap(<SqlWidgets />);
    fireEvent.click(screen.getByText("+ New widget"));
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("sql-widget-editor-backdrop"));
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("disables Save until a successful preview matches the current SQL", async () => {
    const previewMock = vi.fn().mockResolvedValue({
      columns: ["v"], rows: [{ v: 1 }], truncated: false, durationMs: 1,
      inferred_viz: "number",
    });
    vi.spyOn(hooks, "useSqlWidgets").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(hooks, "useSqlDataSources").mockReturnValue({
      data: [{ name: "sportly", kind: "app", scope: "app", app_slug: "sportly" }], isLoading: false,
    } as any);
    vi.spyOn(hooks, "useSqlPreview").mockReturnValue({
      mutateAsync: previewMock, isPending: false, data: undefined, reset: vi.fn(),
    } as any);
    vi.spyOn(hooks, "useCreateSqlWidget").mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.spyOn(hooks, "useUpdateSqlWidget").mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    vi.spyOn(hooks, "useDeleteSqlWidget").mockReturnValue({ mutateAsync: vi.fn() } as any);

    wrap(<SqlWidgets />);
    fireEvent.click(screen.getByText("+ New widget"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Data source"), { target: { value: "sportly" } });
    fireEvent.change(screen.getByLabelText("SQL"), { target: { value: "SELECT 1" } });

    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => expect(previewMock).toHaveBeenCalled());

    await waitFor(() => expect(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled
    ).toBe(false));

    // Editing SQL after preview re-disables save
    fireEvent.change(screen.getByLabelText("SQL"), { target: { value: "SELECT 2" } });
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders preview error message", async () => {
    vi.spyOn(hooks, "useSqlWidgets").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(hooks, "useSqlDataSources").mockReturnValue({
      data: [{ name: "sportly", kind: "app", scope: "app", app_slug: "sportly" }], isLoading: false,
    } as any);
    const previewMock = vi.fn().mockRejectedValue(new Error("bad_sql"));
    vi.spyOn(hooks, "useSqlPreview").mockReturnValue({
      mutateAsync: previewMock, isPending: false, reset: vi.fn(),
    } as any);
    vi.spyOn(hooks, "useCreateSqlWidget").mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(hooks, "useUpdateSqlWidget").mockReturnValue({ mutateAsync: vi.fn() } as any);
    vi.spyOn(hooks, "useDeleteSqlWidget").mockReturnValue({ mutateAsync: vi.fn() } as any);

    wrap(<SqlWidgets />);
    fireEvent.click(screen.getByText("+ New widget"));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Data source"), { target: { value: "sportly" } });
    fireEvent.change(screen.getByLabelText("SQL"), { target: { value: "SELECT 1; SELECT 2" } });
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => expect(screen.getByText(/bad_sql/i)).toBeInTheDocument());
  });
});

describe("SqlWidgets delete", () => {
  it("calls delete mutation when Delete clicked", async () => {
    const delMock = vi.fn().mockResolvedValue({ ok: true });
    vi.spyOn(hooks, "useSqlWidgets").mockReturnValue({
      data: [{ id: 5, name: "Doomed", description: null, data_source: "sportly",
                sql: "SELECT 1", viz: "table", options: {}, created_at: "", updated_at: "" }],
      isLoading: false,
    } as any);
    vi.spyOn(hooks, "useSqlDataSources").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(hooks, "useDeleteSqlWidget").mockReturnValue({ mutateAsync: delMock } as any);
    wrap(<SqlWidgets />);
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    fireEvent.click(within(screen.getByRole("dialog")).getByText("Delete"));
    await waitFor(() => expect(delMock).toHaveBeenCalledWith(5));
  });
});
