import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SqlTable } from "@/widgets/sql";

describe("SqlTable", () => {
  it("renders headers and cells", () => {
    render(<SqlTable result={{
      columns: ["name", "count"],
      rows: [{ name: "Alice", count: 3 }, { name: "Bob", count: 5 }],
      truncated: false, durationMs: 1,
    }} />);
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });
  it("filters columns when options.columns is set", () => {
    render(<SqlTable
      result={{ columns: ["a", "b", "c"], rows: [{ a: 1, b: 2, c: 3 }], truncated: false, durationMs: 1 }}
      options={{ columns: ["a", "c"] }}
    />);
    expect(screen.queryByText("b")).toBeNull();
    expect(screen.getByText("c")).toBeInTheDocument();
  });
  it("formats date cells", () => {
    render(<SqlTable result={{
      columns: ["day"],
      rows: [{ day: "2026-05-21" }],
      truncated: false,
      durationMs: 1,
    }} />);
    expect(screen.queryByText("2026-05-21")).toBeNull();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });
});
