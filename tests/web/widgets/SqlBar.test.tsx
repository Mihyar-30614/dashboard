import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SqlBar } from "@/widgets/sql";

describe("SqlBar", () => {
  it("renders an SVG for a basic bar series", () => {
    const { container } = render(<SqlBar
      result={{
        columns: ["label", "count"],
        rows: [{ label: "a", count: 1 }, { label: "b", count: 3 }],
        truncated: false, durationMs: 1,
      }}
      options={{ xCol: "label", yCol: "count" }}
    />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("falls back to the first column when xCol names a dropped column", () => {
    const { container } = render(<SqlBar
      result={{
        columns: ["month_year", "total"],
        rows: [{ month_year: "Jan 2026", total: 1 }, { month_year: "Feb 2026", total: 3 }],
        truncated: false, durationMs: 1,
      }}
      options={{ xCol: "month", yCol: "total" }}
    />);
    expect(container.textContent).toContain("Jan 2026");
  });

  it("ignores a yCol that names a dropped column", () => {
    const { container } = render(<SqlBar
      result={{
        columns: ["label", "count"],
        rows: [{ label: "a", count: 1 }, { label: "b", count: 3 }],
        truncated: false, durationMs: 1,
      }}
      options={{ xCol: "label", yCol: "amount" }}
    />);
    expect(container.querySelectorAll(".recharts-bar").length).toBe(1);
  });
});
