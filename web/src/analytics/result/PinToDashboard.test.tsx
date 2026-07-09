import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PinToDashboard from "./PinToDashboard";
import { api } from "../../api/client";
import type { QA } from "../types";

vi.mock("../../api/client", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

const QA_FIXTURE: QA = {
  question: "how many users signed up per day",
  sql: "SELECT created_at::date AS day, count(*) FROM users GROUP BY 1",
  answer: null,
  data: [],
} as unknown as QA;

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function mockGets({ admin }: { admin: boolean }) {
  (api.get as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
    if (path === "/api/auth/me") {
      return Promise.resolve({ id: 1, email: "a@b.c", is_admin: admin });
    }
    if (path === "/api/sql-widgets/sources") {
      return Promise.resolve([
        { name: "sportly", kind: "app", scope: "app", app_slug: "sportly" },
        { name: "dashboard", kind: "dashboard", scope: "overview" },
      ]);
    }
    return Promise.reject(new Error("unexpected " + path));
  });
}

describe("PinToDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing for non-admins", async () => {
    mockGets({ admin: false });
    renderWithClient(<PinToDashboard qa={QA_FIXTURE} dbName="sportly" onToast={() => {}} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByText("+ dashboard")).toBeNull();
  });

  it("renders nothing when the answer has no SQL", async () => {
    mockGets({ admin: true });
    renderWithClient(
      <PinToDashboard qa={{ ...QA_FIXTURE, sql: null }} dbName="sportly" onToast={() => {}} />,
    );
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByText("+ dashboard")).toBeNull();
  });

  it("previews then creates a widget with the inferred viz", async () => {
    mockGets({ admin: true });
    (api.post as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path === "/api/sql-widgets/preview") {
        return Promise.resolve({ columns: ["day", "count"], rows: [], truncated: false, durationMs: 1, inferred_viz: "line" });
      }
      if (path === "/api/sql-widgets") {
        return Promise.resolve({ id: 7 });
      }
      return Promise.reject(new Error("unexpected " + path));
    });
    const onToast = vi.fn();
    renderWithClient(<PinToDashboard qa={QA_FIXTURE} dbName="sportly" onToast={onToast} />);

    fireEvent.click(await screen.findByText("+ dashboard"));
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => expect(onToast).toHaveBeenCalledWith(expect.stringMatching(/added/i), "ok"));
    expect(api.post).toHaveBeenCalledWith(
      "/api/sql-widgets",
      expect.objectContaining({
        name: QA_FIXTURE.question.slice(0, 80),
        data_source: "sportly",
        sql: QA_FIXTURE.sql,
        viz: "line",
      }),
    );
  });
});
