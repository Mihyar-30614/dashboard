import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SqlNumber } from "@/widgets/sql";

describe("SqlNumber", () => {
  it("renders the first column of the first row", () => {
    render(<SqlNumber result={{ columns: ["v"], rows: [{ v: 42 }], truncated: false, durationMs: 1 }} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });
  it("applies unit suffix from options", () => {
    render(<SqlNumber
      result={{ columns: ["v"], rows: [{ v: 5 }], truncated: false, durationMs: 1 }}
      options={{ unit: "%" }}
    />);
    expect(screen.getByText("5%")).toBeInTheDocument();
  });
  it("formats with decimals when provided", () => {
    render(<SqlNumber
      result={{ columns: ["v"], rows: [{ v: 3.14159 }], truncated: false, durationMs: 1 }}
      options={{ decimals: 2 }}
    />);
    expect(screen.getByText("3.14")).toBeInTheDocument();
  });
  it("renders em-dash for empty result", () => {
    render(<SqlNumber result={{ columns: [], rows: [], truncated: false, durationMs: 1 }} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
