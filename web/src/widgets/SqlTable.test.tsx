import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SqlTable from "./SqlTable";

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
  it("renders truncated badge when result.truncated", () => {
    render(<SqlTable result={{ columns: ["a"], rows: [{ a: 1 }], truncated: true, durationMs: 1 }} />);
    expect(screen.getByText(/truncated/i)).toBeInTheDocument();
  });
});
