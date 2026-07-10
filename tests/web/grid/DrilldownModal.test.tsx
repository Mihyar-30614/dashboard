import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DrilldownModal from "@/grid/DrilldownModal";
import WidgetFrame from "@/grid/WidgetFrame";
import { ExpandContext } from "@/grid/expandContext";
import type { GridWidget } from "@/grid/GridCanvas";

vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

const WIDGET: GridWidget = {
  id: "w_1",
  kind: "kpi_timeseries",
  app: "sportly",
  x: 0,
  y: 0,
  w: 6,
  h: 4,
  params: { key: "mrr" },
};

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("WidgetFrame expand", () => {
  it("shows no expand button without context", () => {
    render(<WidgetFrame title="t">x</WidgetFrame>);
    expect(screen.queryByLabelText("Expand widget")).toBeNull();
  });

  it("calls onExpand from context", () => {
    const onExpand = vi.fn();
    render(
      <ExpandContext.Provider value={{ onExpand }}>
        <WidgetFrame title="t">x</WidgetFrame>
      </ExpandContext.Provider>,
    );
    fireEvent.click(screen.getByLabelText("Expand widget"));
    expect(onExpand).toHaveBeenCalled();
  });
});

describe("DrilldownModal", () => {
  it("renders the widget with a range switcher and closes", () => {
    const onClose = vi.fn();
    wrap(<DrilldownModal widget={WIDGET} pageRange="30d" onClose={onClose} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const btn30 = screen.getByRole("button", { name: "30d" });
    expect(btn30.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "90d" }));
    expect(
      screen.getByRole("button", { name: "90d" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByLabelText("Close expanded view"));
    expect(onClose).toHaveBeenCalled();
  });
});
