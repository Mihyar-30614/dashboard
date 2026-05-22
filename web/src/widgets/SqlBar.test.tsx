import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import SqlBar from "./SqlBar";

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
});
