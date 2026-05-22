import { describe, it, expect } from "vitest";
import { pickTab } from "../result/pickTab";

describe("pickTab", () => {
  it("returns table for 0 rows", () => {
    expect(pickTab([])).toBe("table");
  });
  it("returns table for 1 row × 1 col (metric case rendered inside table)", () => {
    expect(pickTab([{ count: 42 }])).toBe("table");
  });
  it("returns chart for 1 numeric + 1 categorical, small", () => {
    const rows = [
      { region: "EU", users: 100 },
      { region: "US", users: 80 },
      { region: "APAC", users: 60 },
    ];
    expect(pickTab(rows)).toBe("chart");
  });
  it("returns table when categorical+numeric exceeds 30 rows", () => {
    const rows = Array.from({ length: 31 }, (_, i) => ({
      city: `c${i}`,
      n: i,
    }));
    expect(pickTab(rows)).toBe("table");
  });
  it("returns chart (line) when a date column + numeric column present", () => {
    const rows = [
      { day: "2026-01-01", revenue: 100 },
      { day: "2026-01-02", revenue: 120 },
      { day: "2026-01-03", revenue: 90 },
    ];
    expect(pickTab(rows)).toBe("chart");
  });
  it("returns table for all-string columns", () => {
    const rows = [
      { name: "a", desc: "x" },
      { name: "b", desc: "y" },
    ];
    expect(pickTab(rows)).toBe("table");
  });
  it("returns table for 3+ numeric columns without a date", () => {
    const rows = [
      { a: 1, b: 2, c: 3 },
      { a: 4, b: 5, c: 6 },
    ];
    expect(pickTab(rows)).toBe("table");
  });
});
