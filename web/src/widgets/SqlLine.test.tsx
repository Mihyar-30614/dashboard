import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import SqlLine from "./SqlLine";

describe("SqlLine", () => {
  it("renders without crashing for a basic line series", () => {
    const { container } = render(<SqlLine
      result={{
        columns: ["t", "value"],
        rows: [{ t: "2026-05-01", value: 1 }, { t: "2026-05-02", value: 2 }],
        truncated: false, durationMs: 1,
      }}
      options={{ xCol: "t", yCol: "value" }}
    />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
  it("renders multi-series when yCol is an array", () => {
    const { container } = render(<SqlLine
      result={{
        columns: ["t", "a", "b"],
        rows: [{ t: "2026-05-01", a: 1, b: 2 }],
        truncated: false, durationMs: 1,
      }}
      options={{ xCol: "t", yCol: ["a", "b"] }}
    />);
    expect(container.querySelectorAll(".recharts-line").length).toBeGreaterThanOrEqual(2);
  });
});
